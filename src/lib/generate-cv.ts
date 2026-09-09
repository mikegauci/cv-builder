import OpenAI from "openai";
import { DEFAULT_TIMELINE_NOTES } from "@/lib/generate-cv-defaults";
import type { CvEntry, CvSectionType, CvWithEntries } from "@/lib/types";

export { DEFAULT_TIMELINE_NOTES };

const STABLE_SECTIONS: CvSectionType[] = ["education", "languages", "courses"];
const COMPACT_SECTIONS: CvSectionType[] = ["languages", "skills"];
const NO_DESCRIPTION_SECTIONS: CvSectionType[] = ["courses"];

const SYSTEM_PROMPT = `You are an expert CV writer. You tailor one CV for a specific job using ONLY facts from the candidate's existing CVs.

Rules:
- Never invent employers, job titles they did not hold, degrees, tools, skills, or achievements that do not appear in the source CVs.
- You MAY rewrite the summary and experience bullets so they emphasize keywords and requirements from the job description.
- You MAY reorder roles and omit weaker-fit jobs if the CV would be too long, but keep a coherent career story.
- You MAY regroup skills into categories that match the job, using only skills that already appear in the source CVs.
- Experience descriptions must use this markdown-ish format: each bullet on its own line starting with "- ", and **bold** for emphasis.
- Skills: "title" is the category name; "description" is a comma-separated list (no bullets).
- Dates: follow the timeline notes. Pick date_label strings from variants already present in the source CVs unless the timeline notes say otherwise. Do not invent new employers.
- Do not present three simultaneous full-time jobs.
- slug: lowercase letters, numbers, and dashes only.
- target_role should match the job posting title, or the closest honest fit from the candidate's experience.
- title is an admin label for this tailored version (the target role, or "Company – Role" if a company is provided).`;

const tailoredCvJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    target_role: { type: "string" },
    summary: { type: "string" },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          subtitle: { type: ["string", "null"] },
          date_label: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
        },
        required: ["title", "subtitle", "date_label", "description"],
      },
    },
    skills: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["title", "description"],
      },
    },
  },
  required: ["title", "slug", "target_role", "summary", "experience", "skills"],
} as const;

export interface GeneratedCvContent {
  title: string;
  slug: string;
  target_role: string;
  summary: string;
  experience: GeneratedExperienceEntry[];
  skills: GeneratedSkillEntry[];
}

interface GeneratedExperienceEntry {
  title: string;
  subtitle: string | null;
  date_label: string | null;
  description: string | null;
}

interface GeneratedSkillEntry {
  title: string;
  description: string;
}

export interface GenerateTailoredCvInput {
  jobDescription: string;
  companyName: string;
  timelineNotes: string;
  sourceCvs: CvWithEntries[];
}

export async function generateTailoredCv(input: GenerateTailoredCvInput): Promise<GeneratedCvContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o",
    temperature: 0.4,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "tailored_cv",
        strict: true,
        schema: tailoredCvJsonSchema,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  const parsed = JSON.parse(content) as GeneratedCvContent;
  if (!parsed.target_role?.trim() || !Array.isArray(parsed.experience) || parsed.experience.length === 0) {
    throw new Error("OpenAI returned an incomplete CV.");
  }

  return parsed;
}

export function copyStableEntries(sourceCvs: CvWithEntries[]): Array<Omit<CvEntry, "id" | "cv_id">> {
  const result: Array<Omit<CvEntry, "id" | "cv_id">> = [];

  for (const section of STABLE_SECTIONS) {
    const entries = firstSectionEntries(sourceCvs, section);
    entries.forEach((entry, index) => {
      result.push({
        section,
        item_order: index + 1,
        title: entry.title,
        subtitle: entry.subtitle,
        date_label: COMPACT_SECTIONS.includes(section) ? null : entry.date_label,
        description: NO_DESCRIPTION_SECTIONS.includes(section) ? null : entry.description,
      });
    });
  }

  return result;
}

export function buildGeneratedEntries(
  generated: GeneratedCvContent,
  sourceCvs: CvWithEntries[]
): Array<Omit<CvEntry, "id" | "cv_id">> {
  const experience = generated.experience
    .filter((entry) => entry.title.trim().length > 0)
    .map((entry, index) => ({
      section: "experience" as const,
      item_order: index + 1,
      title: entry.title.trim(),
      subtitle: entry.subtitle?.trim() || null,
      date_label: entry.date_label?.trim() || null,
      description: entry.description?.trim() || null,
    }));

  const skills = generated.skills
    .filter((entry) => entry.title.trim().length > 0)
    .map((entry, index) => ({
      section: "skills" as const,
      item_order: index + 1,
      title: entry.title.trim(),
      subtitle: null,
      date_label: null,
      description: entry.description.trim() || null,
    }));

  return [...experience, ...skills, ...copyStableEntries(sourceCvs)];
}

export function normalizeGeneratedSlug(raw: string): string {
  const slug = raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "tailored-cv";
}

function buildUserPrompt(input: GenerateTailoredCvInput): string {
  const sourcePayload = input.sourceCvs.map((data) => ({
    title: data.cv.title,
    target_role: data.cv.target_role,
    summary: data.cv.summary,
    entries: data.entries.map((entry) => ({
      section: entry.section,
      title: entry.title,
      subtitle: entry.subtitle,
      date_label: entry.date_label,
      description: entry.description,
    })),
  }));

  const companyLine = input.companyName
    ? `Company name for this application: ${input.companyName}`
    : "No company name was provided.";

  return [
    "Job description:",
    input.jobDescription,
    "",
    companyLine,
    "",
    "Timeline notes:",
    input.timelineNotes || DEFAULT_TIMELINE_NOTES,
    "",
    "Existing CVs as JSON (the only allowed source of facts):",
    JSON.stringify(sourcePayload),
  ].join("\n");
}

function firstSectionEntries(sourceCvs: CvWithEntries[], section: CvSectionType): CvEntry[] {
  for (const source of sourceCvs) {
    const entries = source.entries.filter((entry) => entry.section === section);
    if (entries.length > 0) {
      return entries;
    }
  }
  return [];
}
