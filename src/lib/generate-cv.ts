import OpenAI from "openai";
import { getOpenAiModel, getOpenAiTemperature } from "@/lib/openai-model";
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

const SYSTEM_PROMPT = `You are an expert CV writer. You tailor one CV for a specific job using ONLY facts from the candidate's existing CVs and the provided skill pool.

Rules:
- Never invent employers, job titles they did not hold, degrees, projects, products, metrics, team sizes, or achievements that do not appear in the source CVs.
- You MUST rewrite the summary and every experience bullet. Do not copy bullets verbatim from the source CVs.
- The summary MUST be 3-5 sentences, open with the JD role title, and explicitly address the top three must_have_requirements using jd_summary as the brief.
- Experience: 6-8 bullets per role (every role in the output). At least half of the bullets in recent roles (Winnables, Momentum, NetEnt) MUST map to a core_responsibility or must_have_requirement. Reframe real work in the JD's vocabulary and ATS keywords.
- All existing CV versions are provided. Pick the strongest phrasing and facts across them, but the output experience timeline must match the Senior Full Stack Engineer CV only. Never omit pre-NetEnt roles: Web Project Manager (Kenmore Design), Frontend Developer (GIG), Junior Frontend Developer (ArenaCube). Include Motor Element if it appears in that timeline. Do NOT output roles outside that timeline (e.g. Tiugo/TinyMCE, Kindred, FDJ). Only omit Kindred/FDJ management roles (merged into Winnables per rules below).
- Experience role selection (for frontend, full-stack, or engineering IC roles): NEVER output "Engineering Manager" or "Technical Product Owner" as separate experience entries. Those are management/product roles — do not substitute them for IC titles. Extract relevant leadership, delivery, mentoring, and technical-review bullets from those roles and merge them into "Senior Full Stack Developer (Front leaning)" at Winnables (up to 8 bullets total for that role).
- Experience descriptions must use this markdown-ish format: each bullet on its own line starting with "- ", and **bold** for emphasis.
- Skills: build 5-7 categories whose names mirror the JD stack headings (e.g. "Real-time Communication & Messaging", "Infrastructure & Orchestration"). Order categories by JD relevance. Fill each category ONLY from the skill pool and source CV skills. Never invent a skill that is not in the pool or source CVs. Omit JD tech_stack items with no pool match.
- Skills: "title" is the category name; "description" is a comma-separated list (no bullets).
- Dates: use date_label strings from source CVs. Do not invent employers or date ranges. Avoid overlapping full-time roles — contractor entries (subtitle contains "Contractor") may run alongside other work. Prefer: Winnables "August 2025 – August 2026", Momentum "September 2022 – May 2025", NetEnt "July 2019 – April 2022". Do not show Kindred/FDJ periods as separate entries for IC-tailored CVs.
- coverage: for each of the top 8 must_have_requirements, report whether the tailored CV covers it as strong, partial, or missing, with brief evidence.
- target_role should match the job posting title, or the closest honest fit from the candidate's experience.
- title is an admin label for this tailored version (the target role, or "Company – Role" if a company is provided).

Example of honest reframing (only if WebSockets appears in the pool or source CVs):
Source bullet: "Built battles, pack opening, rewards, wallet flows"
Rewritten: "Built **real-time, event-driven gameplay features** (battles, pack opening, rewards, wallet flows) integrated with backend services"`;

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

const EXCLUDED_IC_ROLE_TITLES = new Set(["engineering manager", "technical product owner"]);

export async function generateTailoredCv(input: GenerateTailoredCvInput): Promise<GeneratedCvContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const model = getOpenAiModel();

  console.log("[generate-cv] Stage 2: tailoring CV", {
    model,
    sourceCvCount: input.sourceCvs.length,
    skillPoolCount: input.skillPool.length,
    companyName: input.companyName || null,
    targetRole: input.jdAnalysis.role_title,
  });
  const startedAt = Date.now();

  const temperature = getOpenAiTemperature(model, 0.6);

  const completion = await openai.chat.completions.create({
    model,
    ...(temperature !== undefined ? { temperature } : {}),
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

  if (!Array.isArray(parsed.coverage)) {
    parsed.coverage = [];
  }

  if (!Array.isArray(parsed.skills)) {
    parsed.skills = [];
  }

  const beforeSanitize = parsed.experience.length;
  parsed.experience = sanitizeGeneratedExperience(parsed.experience, input.sourceCvs);
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
    sourceCvs.reduce((best, current) => {
      const bestCount = best.entries.filter((entry) => entry.section === "experience").length;
      const currentCount = current.entries.filter((entry) => entry.section === "experience").length;
      return currentCount > bestCount ? current : best;
    }, sourceCvs[0])
  );
}

function firstSectionEntries(sourceCvs: CvWithEntries[], section: CvSectionType): CvEntry[] {
  const preferredEntries = sourceCvs
    .length > 0
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
  sourceCvs: CvWithEntries[]
): GeneratedExperienceEntry[] {
  const generatedEm = experience.find(
    (entry) => entry.title.trim().toLowerCase() === "engineering manager"
  );
  const emBullets =
    parseExperienceBullets(generatedEm?.description ?? null) ||
    getSourceRoleBullets(sourceCvs, "Engineering Manager");

  const withoutExcludedTitles = experience.filter(
    (entry) => !EXCLUDED_IC_ROLE_TITLES.has(entry.title.trim().toLowerCase())
  );
  const filtered = filterToCanonicalRolesOnly(withoutExcludedTitles, sourceCvs);

  const winnablesIndex = filtered.findIndex((entry) =>
    entry.title.toLowerCase().includes("senior full stack developer")
  );

  if (winnablesIndex !== -1) {
    const existingBullets = parseExperienceBullets(filtered[winnablesIndex].description);
    const seen = new Set(existingBullets.map(normalizeBullet));
    const mergedBullets = [...existingBullets];

    for (const bullet of emBullets) {
      const key = normalizeBullet(bullet);
      if (!seen.has(key)) {
        mergedBullets.push(bullet);
        seen.add(key);
      }
      if (mergedBullets.length >= 8) break;
    }

    filtered[winnablesIndex] = {
      ...filtered[winnablesIndex],
      description: mergedBullets.join("\n"),
    };
  }

  return finalizeExperience(filtered, sourceCvs);
}

function finalizeExperience(
  experience: GeneratedExperienceEntry[],
  sourceCvs: CvWithEntries[]
): GeneratedExperienceEntry[] {
  const withDates = applyPreferredDates(experience, sourceCvs);
  const withBackfill = backfillMissingExperienceRoles(withDates, sourceCvs);
  return ensureMinimumExperienceBullets(withBackfill, sourceCvs);
}

function experienceRoleKey(entry: GeneratedExperienceEntry): string {
  return `${entry.title.trim().toLowerCase()}::${(entry.subtitle ?? "").trim().toLowerCase()}`;
}

function filterToCanonicalRolesOnly(
  experience: GeneratedExperienceEntry[],
  sourceCvs: CvWithEntries[]
): GeneratedExperienceEntry[] {
  const canonicalKeys = new Set(getCanonicalExperienceRoles(sourceCvs).map(experienceRoleKey));
  const filtered = experience.filter((entry) => canonicalKeys.has(experienceRoleKey(entry)));
  const removed = experience.filter((entry) => !canonicalKeys.has(experienceRoleKey(entry)));

  if (removed.length > 0) {
    console.log("[generate-cv] Removed non-canonical experience roles", {
      removed: removed.map((entry) => ({
        title: entry.title,
        subtitle: entry.subtitle,
        date: entry.date_label,
      })),
    });
  }

  return filtered;
}

function getCanonicalExperienceRoles(sourceCvs: CvWithEntries[]): GeneratedExperienceEntry[] {
  return getPreferredSourceCv(sourceCvs).entries
    .filter((entry) => entry.section === "experience")
    .filter((entry) => !EXCLUDED_IC_ROLE_TITLES.has(entry.title.trim().toLowerCase()))
    .sort((a, b) => a.item_order - b.item_order)
    .map((entry) => ({
      title: entry.title.trim(),
      subtitle: entry.subtitle?.trim() || null,
      date_label: entry.date_label?.trim() || null,
      description: entry.description?.trim() || null,
    }));
}

function backfillMissingExperienceRoles(
  experience: GeneratedExperienceEntry[],
  sourceCvs: CvWithEntries[]
): GeneratedExperienceEntry[] {
  const canonical = getCanonicalExperienceRoles(sourceCvs);
  const present = new Set(experience.map(experienceRoleKey));
  const backfilled: GeneratedExperienceEntry[] = [];

  for (const role of canonical) {
    const key = experienceRoleKey(role);
    if (present.has(key)) continue;

    backfilled.push({
      ...role,
      description: trimExperienceBullets(role.description, 8),
    });
    present.add(key);
  }

  if (backfilled.length > 0) {
    console.log("[generate-cv] Backfilled missing experience roles", {
      roles: backfilled.map((entry) => ({
        title: entry.title,
        subtitle: entry.subtitle,
        date: entry.date_label,
      })),
    });
  }

  const order = new Map(canonical.map((role, index) => [experienceRoleKey(role), index]));
  return [...experience, ...backfilled].sort(
    (a, b) => (order.get(experienceRoleKey(a)) ?? 999) - (order.get(experienceRoleKey(b)) ?? 999)
  );
}

function trimExperienceBullets(description: string | null, maxBullets: number): string | null {
  const bullets = parseExperienceBullets(description);
  if (bullets.length === 0) return description;
  return bullets.slice(0, maxBullets).join("\n");
}

const MIN_EXPERIENCE_BULLETS = 6;
const MAX_EXPERIENCE_BULLETS = 8;

function countExperienceBullets(description: string | null): number {
  return parseExperienceBullets(description).length;
}

function ensureMinimumExperienceBullets(
  experience: GeneratedExperienceEntry[],
  sourceCvs: CvWithEntries[]
): GeneratedExperienceEntry[] {
  const canonical = getCanonicalExperienceRoles(sourceCvs);
  const canonicalByKey = new Map(canonical.map((role) => [experienceRoleKey(role), role]));

  return experience.map((entry) => {
    if (countExperienceBullets(entry.description) >= MIN_EXPERIENCE_BULLETS) {
      return {
        ...entry,
        description: trimExperienceBullets(entry.description, MAX_EXPERIENCE_BULLETS),
      };
    }

    const source = canonicalByKey.get(experienceRoleKey(entry));
    if (!source?.description) return entry;

    const existing = parseExperienceBullets(entry.description);
    const seen = new Set(existing.map(normalizeBullet));
    const merged = [...existing];

    for (const bullet of parseExperienceBullets(source.description)) {
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

function parseExperienceBullets(description: string | null): string[] {
  if (!description) return [];
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("•"))
    .map((line) => (line.startsWith("- ") ? line : `- ${line.replace(/^•\s*/, "")}`));
}

function normalizeBullet(bullet: string): string {
  return bullet.replace(/\*\*/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function getSourceRoleBullets(sourceCvs: CvWithEntries[], roleTitle: string): string[] {
  const target = roleTitle.toLowerCase();
  for (const source of sourceCvs) {
    const entry = source.entries.find(
      (item) =>
        item.section === "experience" && item.title.trim().toLowerCase() === target
    );
    if (entry?.description) {
      return parseExperienceBullets(entry.description);
    }
  }
  return [];
}

const PREFERRED_DATES: Array<{ match: (title: string, subtitle: string | null) => boolean; date: string }> = [
  {
    match: (title) => title.toLowerCase().includes("senior full stack developer"),
    date: "August 2025 – August 2026",
  },
  {
    match: (title, subtitle) =>
      title.toLowerCase().includes("senior frontend engineer") &&
      (subtitle?.toLowerCase().includes("momentum") ?? false),
    date: "September 2022 – May 2025",
  },
  {
    match: (title, subtitle) =>
      (title.toLowerCase().includes("web developer") ||
        title.toLowerCase().includes("wordpress developer")) &&
      (subtitle?.toLowerCase().includes("netent") ?? false),
    date: "July 2019 – April 2022",
  },
];

function applyPreferredDates(
  experience: GeneratedExperienceEntry[],
  sourceCvs: CvWithEntries[]
): GeneratedExperienceEntry[] {
  return experience.map((entry) => {
    const preferred = PREFERRED_DATES.find((rule) =>
      rule.match(entry.title, entry.subtitle)
    );
    if (preferred) {
      return { ...entry, date_label: preferred.date };
    }

    const sourceDate = findSourceDateLabel(sourceCvs, entry.title, entry.subtitle);
    return sourceDate ? { ...entry, date_label: sourceDate } : entry;
  });
}

function findSourceDateLabel(
  sourceCvs: CvWithEntries[],
  title: string,
  subtitle: string | null
): string | null {
  const titleKey = title.trim().toLowerCase();
  const subtitleKey = subtitle?.trim().toLowerCase() ?? "";

  for (const source of sourceCvs) {
    const entry = source.entries.find(
      (item) =>
        item.section === "experience" &&
        item.title.trim().toLowerCase() === titleKey &&
        (subtitleKey.length === 0 ||
          item.subtitle?.trim().toLowerCase() === subtitleKey)
    );
    if (entry?.date_label) {
      return entry.date_label.trim();
    }
  }

  return null;
}
