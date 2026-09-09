import OpenAI from "openai";
import { getOpenAiModel, getOpenAiTemperature } from "@/lib/openai-model";
import type { Cv, CvEntry, JdAnalysis, JdCoverageItem } from "@/lib/types";

const SYSTEM_PROMPT = `You are an expert cover letter writer for senior software engineers.
Write only the letter body — no salutation, sign-off, signature, subject line, address block, or date.
The page renders "Dear {Company} Hiring Team," and the closing with contact details separately.

Rules:
- Exactly 4 paragraphs, roughly 300-350 words total, first person, professional but human.
- Paragraph 1: name the role and company, and state the single strongest reason the candidate fits.
- Paragraph 2: the most JD-relevant experience, using concrete evidence (metrics, stack, scale) from the CV bullets.
- Paragraph 3: why this company and domain specifically, tied to the JD's stated responsibilities.
- Paragraph 4: a confident, brief close.
- Only use facts present in the supplied CV. Never invent employers, dates, metrics, or technologies.
- Do not claim any requirement the CV does not support. Where jd_coverage marks a requirement as "missing", do not imply the candidate has it.
- Reuse the JD's own vocabulary and ATS keywords where truthful.
- No bullet lists, no markdown headings, no clichés ("I am writing to apply", "team player", "passionate about").`;

const coverLetterJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    paragraphs: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["paragraphs"],
} as const;

export interface GenerateCoverLetterInput {
  cv: Cv;
  entries: CvEntry[];
  jobDescription: string;
  jdAnalysis: JdAnalysis | null;
  companyName: string;
  roleTitle: string;
}

export function buildCoverLetterSlugBase(roleTitle: string, companyName: string): string {
  return `${companyName.trim()} ${roleTitle.trim()}`;
}

export async function generateCoverLetter(
  input: GenerateCoverLetterInput
): Promise<{ body: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const model = getOpenAiModel();
  const startedAt = Date.now();

  console.log("[generate-cover-letter] Starting generation", {
    model,
    cvId: input.cv.id,
    companyName: input.companyName,
    roleTitle: input.roleTitle,
    jdLength: input.jobDescription.length,
  });

  const experienceText = formatExperienceEntries(input.entries);
  const skillsText = formatSkillsEntries(input.entries);
  const jdAnalysisText = formatJdAnalysis(input.jdAnalysis);
  const coverageText = formatCoverage(input.cv.jd_coverage);

  const userContent = [
    `Target role: ${input.roleTitle}`,
    `Company: ${input.companyName}`,
    "",
    "CV summary:",
    input.cv.summary?.trim() || "(none)",
    "",
    "Experience:",
    experienceText || "(none)",
    "",
    "Skills:",
    skillsText || "(none)",
    "",
    jdAnalysisText,
    "",
    coverageText,
    "",
    "Job description:",
    input.jobDescription,
  ].join("\n");

  const temperature = getOpenAiTemperature(model, 0.7);

  const completion = await openai.chat.completions.create({
    model,
    ...(temperature !== undefined ? { temperature } : {}),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "cover_letter",
        strict: true,
        schema: coverLetterJsonSchema,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty cover letter.");
  }

  const parsed = JSON.parse(content) as { paragraphs: string[] };
  const paragraphs = parsed.paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (paragraphs.length < 3 || paragraphs.length > 5) {
    throw new Error(`OpenAI returned ${paragraphs.length} paragraphs; expected 3-5.`);
  }

  const body = paragraphs.join("\n\n");
  const wordCount = body.split(/\s+/).filter(Boolean).length;

  console.log("[generate-cover-letter] Generation complete", {
    durationMs: Date.now() - startedAt,
    paragraphCount: paragraphs.length,
    wordCount,
    usage: completion.usage,
  });

  return { body };
}

function formatExperienceEntries(entries: CvEntry[]): string {
  const experience = entries
    .filter((e) => e.section === "experience")
    .sort((a, b) => a.item_order - b.item_order);

  return experience
    .map((entry) => {
      const header = [entry.title, entry.subtitle, entry.date_label].filter(Boolean).join(" — ");
      const bullets = entry.description?.trim() || "";
      return `${header}\n${bullets}`;
    })
    .join("\n\n");
}

function formatSkillsEntries(entries: CvEntry[]): string {
  const skills = entries
    .filter((e) => e.section === "skills")
    .sort((a, b) => a.item_order - b.item_order);

  return skills
    .map((entry) => {
      const desc = entry.description?.trim();
      return desc ? `${entry.title}: ${desc}` : entry.title;
    })
    .join("\n");
}

function formatJdAnalysis(analysis: JdAnalysis | null): string {
  if (!analysis) {
    return "JD analysis: (not available)";
  }

  return [
    "JD analysis:",
    `Summary: ${analysis.jd_summary}`,
    `Must-haves: ${analysis.must_have_requirements.join("; ")}`,
    `Responsibilities: ${analysis.core_responsibilities.join("; ")}`,
    `Tech stack: ${analysis.tech_stack.join(", ")}`,
    `ATS keywords: ${analysis.ats_keywords.join(", ")}`,
  ].join("\n");
}

function formatCoverage(coverage: JdCoverageItem[] | null): string {
  if (!coverage || coverage.length === 0) {
    return "JD coverage: (not available)";
  }

  const lines = coverage.map(
    (item) => `- [${item.status}] ${item.requirement}: ${item.evidence}`
  );
  return ["JD coverage (do not claim missing requirements):", ...lines].join("\n");
}
