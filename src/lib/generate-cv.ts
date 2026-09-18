import OpenAI from "openai";
import { getOpenAiModel, getOpenAiTemperature } from "@/lib/openai-model";
import {
  buildCanonicalTimeline,
  buildSystemPrompt,
  normalizeBullet,
  normalizeEmployer,
  parseExperienceBullets,
  rankBullets,
  resolveExperienceCluster,
  resolveRoleTrack,
  selectExperienceTimeline,
  toGeneratedExperience,
  type CanonicalRole,
} from "@/lib/role-track";
import type {
  CvEntry,
  CvSectionType,
  CvWithEntries,
  JdAnalysis,
  JdCoverageItem,
  SkillPoolItem,
} from "@/lib/types";

const STABLE_SECTIONS: CvSectionType[] = ["education", "languages", "courses"];
const COMPACT_SECTIONS: CvSectionType[] = ["languages", "skills"];
const NO_DESCRIPTION_SECTIONS: CvSectionType[] = ["courses"];

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
    coverage: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          requirement: { type: "string" },
          status: { type: "string", enum: ["strong", "partial", "missing"] },
          evidence: { type: "string" },
        },
        required: ["requirement", "status", "evidence"],
      },
    },
  },
  required: ["title", "slug", "target_role", "summary", "experience", "skills", "coverage"],
} as const;

export interface GeneratedCvContent {
  title: string;
  slug: string;
  target_role: string;
  summary: string;
  experience: GeneratedExperienceEntry[];
  skills: GeneratedSkillEntry[];
  coverage: JdCoverageItem[];
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
  sourceCvs: CvWithEntries[];
  jdAnalysis: JdAnalysis;
  skillPool: SkillPoolItem[];
}

const MIN_EXPERIENCE_BULLETS = 6;
const MAX_EXPERIENCE_BULLETS = 8;

export async function generateTailoredCv(input: GenerateTailoredCvInput): Promise<GeneratedCvContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const model = getOpenAiModel();
  const roleTrack = resolveRoleTrack(input.jdAnalysis);
  const experienceCluster = resolveExperienceCluster(input.jdAnalysis);
  const canonicalTimeline = buildCanonicalTimeline(input.sourceCvs);
  const headlineTimeline = selectExperienceTimeline(canonicalTimeline, input.jdAnalysis);

  console.log("[generate-cv] Stage 2: tailoring CV", {
    model,
    sourceCvCount: input.sourceCvs.length,
    skillPoolCount: input.skillPool.length,
    companyName: input.companyName || null,
    targetRole: input.jdAnalysis.role_title,
    roleTrack,
    experienceCluster,
    canonicalRoles: canonicalTimeline.length,
    headlineRoles: headlineTimeline.length,
    headlineEmployers: headlineTimeline.map((role) => role.subtitle ?? role.title),
  });
  const startedAt = Date.now();

  const temperature = getOpenAiTemperature(model, 0.6);
  const systemPrompt = buildSystemPrompt(roleTrack, headlineTimeline, experienceCluster);

  const completion = await openai.chat.completions.create({
    model,
    ...(temperature !== undefined ? { temperature } : {}),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt(input, roleTrack, experienceCluster) },
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

  if (!Array.isArray(parsed.coverage)) {
    parsed.coverage = [];
  }

  if (!Array.isArray(parsed.skills)) {
    parsed.skills = [];
  }

  const beforeSanitize = parsed.experience.length;
  parsed.experience = sanitizeGeneratedExperience(
    parsed.experience,
    headlineTimeline,
    input.jdAnalysis
  );
  console.log("[generate-cv] Experience sanitized", {
    beforeRoles: beforeSanitize,
    afterRoles: parsed.experience.length,
    roles: parsed.experience.map((entry) => ({
      title: entry.title,
      subtitle: entry.subtitle,
      date: entry.date_label,
    })),
  });

  if (parsed.experience.length === 0) {
    throw new Error("OpenAI returned an incomplete CV after experience sanitization.");
  }

  const coverageCounts = parsed.coverage.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  console.log("[generate-cv] Stage 2 complete", {
    durationMs: Date.now() - startedAt,
    targetRole: parsed.target_role,
    slug: parsed.slug,
    summaryLength: parsed.summary.length,
    experienceRoles: parsed.experience.length,
    skillCategories: parsed.skills.length,
    coverage: coverageCounts,
    usage: completion.usage,
  });

  return parsed;
}

export function buildGeneratedTitle(targetRole: string, companyName: string | null): string {
  const role = targetRole.trim();
  if (companyName?.trim()) {
    return `${companyName.trim()} – ${role}`;
  }
  return role;
}

export function buildGeneratedSlugBase(
  targetRole: string,
  companyName: string | null,
  modelSlug?: string
): string {
  if (companyName?.trim()) {
    return `${companyName.trim()} ${targetRole.trim()}`;
  }
  return modelSlug?.trim() || targetRole.trim();
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
    .slice(0, 60)
    .replace(/^-+|-+$/g, "");
  return slug || "generated-cv";
}

function buildUserPrompt(
  input: GenerateTailoredCvInput,
  roleTrack: string,
  experienceCluster: string
): string {
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

  const skillPoolPayload = input.skillPool.map((skill) => ({
    category: skill.category,
    name: skill.name,
    proficiency: skill.proficiency,
    context: skill.context,
  }));

  const companyLine = input.companyName
    ? `Company name for this application: ${input.companyName}`
    : "No company name was provided in the form.";

  return [
    `Detected role track: ${roleTrack}`,
    `Detected experience cluster: ${experienceCluster}`,
    "",
    "Structured JD analysis (use this as the tailoring brief):",
    JSON.stringify(input.jdAnalysis),
    "",
    "Full job description:",
    input.jobDescription,
    "",
    companyLine,
    "",
    "Skill pool (the only allowed source for skills beyond source CVs):",
    JSON.stringify(skillPoolPayload),
    "",
    "All existing CV versions as JSON (pick the best phrasing and facts across them):",
    JSON.stringify(sourcePayload),
  ].join("\n");
}

function getPreferredSourceCv(sourceCvs: CvWithEntries[]): CvWithEntries {
  return (
    sourceCvs.find((source) => source.cv.slug === "senior-full-stack-engineer") ??
    [...sourceCvs].sort(
      (a, b) => new Date(b.cv.updated_at).getTime() - new Date(a.cv.updated_at).getTime()
    )[0]
  );
}

function firstSectionEntries(sourceCvs: CvWithEntries[], section: CvSectionType): CvEntry[] {
  const preferredEntries =
    sourceCvs.length > 0
      ? getPreferredSourceCv(sourceCvs).entries.filter((entry) => entry.section === section)
      : [];
  if (preferredEntries.length > 0) {
    return preferredEntries;
  }

  for (const source of sourceCvs) {
    const entries = source.entries.filter((entry) => entry.section === section);
    if (entries.length > 0) {
      return entries;
    }
  }
  return [];
}

function sanitizeGeneratedExperience(
  experience: GeneratedExperienceEntry[],
  headlineTimeline: CanonicalRole[],
  jdAnalysis: JdAnalysis
): GeneratedExperienceEntry[] {
  const enforced = enforceHeadlineTimeline(experience, headlineTimeline);
  return ensureMinimumExperienceBullets(enforced, headlineTimeline, jdAnalysis);
}

function experienceEmployerKey(entry: GeneratedExperienceEntry): string {
  return normalizeEmployer(entry.subtitle, entry.title);
}

function enforceHeadlineTimeline(
  experience: GeneratedExperienceEntry[],
  headlineTimeline: CanonicalRole[]
): GeneratedExperienceEntry[] {
  const modelByEmployer = new Map<string, GeneratedExperienceEntry>();
  for (const entry of experience) {
    modelByEmployer.set(experienceEmployerKey(entry), entry);
  }

  const removed = experience.filter(
    (entry) =>
      !headlineTimeline.some(
        (role) => experienceEmployerKey(toGeneratedExperience(role)) === experienceEmployerKey(entry)
      )
  );

  if (removed.length > 0) {
    console.log("[generate-cv] Removed non-canonical experience roles", {
      removed: removed.map((entry) => ({
        title: entry.title,
        subtitle: entry.subtitle,
        date: entry.date_label,
      })),
    });
  }

  const backfilled: GeneratedExperienceEntry[] = [];

  const enforced = headlineTimeline.map((role) => {
    const employerKey = experienceEmployerKey(toGeneratedExperience(role));
    const modelEntry = modelByEmployer.get(employerKey);

    if (!modelEntry) {
      backfilled.push({
        title: role.title,
        subtitle: role.subtitle,
        date_label: role.date_label,
        description: null,
      });
      return {
        ...toGeneratedExperience(role),
        description: trimExperienceBullets(role.description, MAX_EXPERIENCE_BULLETS),
      };
    }

    return {
      title: role.title,
      subtitle: role.subtitle,
      date_label: role.date_label,
      description: modelEntry.description,
    };
  });

  if (backfilled.length > 0) {
    console.log("[generate-cv] Backfilled missing experience roles", {
      roles: backfilled.map((entry) => ({
        title: entry.title,
        subtitle: entry.subtitle,
        date: entry.date_label,
      })),
    });
  }

  return enforced;
}

function trimExperienceBullets(description: string | null, maxBullets: number): string | null {
  const bullets = parseExperienceBullets(description);
  if (bullets.length === 0) return description;
  return bullets.slice(0, maxBullets).join("\n");
}

function countExperienceBullets(description: string | null): number {
  return parseExperienceBullets(description).length;
}

function ensureMinimumExperienceBullets(
  experience: GeneratedExperienceEntry[],
  headlineTimeline: CanonicalRole[],
  jdAnalysis: JdAnalysis
): GeneratedExperienceEntry[] {
  const canonicalByKey = new Map(
    headlineTimeline.map((role) => [experienceEmployerKey(toGeneratedExperience(role)), role])
  );

  return experience.map((entry) => {
    if (countExperienceBullets(entry.description) >= MIN_EXPERIENCE_BULLETS) {
      return {
        ...entry,
        description: trimExperienceBullets(entry.description, MAX_EXPERIENCE_BULLETS),
      };
    }

    const source = canonicalByKey.get(experienceEmployerKey(entry));
    if (!source) return entry;

    const existing = parseExperienceBullets(entry.description);
    const seen = new Set(existing.map(normalizeBullet));
    const rankedSourceBullets = rankBullets(source.bulletBank, jdAnalysis);
    const merged = [...existing];

    for (const bullet of rankedSourceBullets) {
      const key = normalizeBullet(bullet);
      if (seen.has(key)) continue;
      merged.push(bullet);
      seen.add(key);
      if (merged.length >= MIN_EXPERIENCE_BULLETS) break;
    }

    return {
      ...entry,
      description: trimExperienceBullets(merged.join("\n"), MAX_EXPERIENCE_BULLETS),
    };
  });
}
