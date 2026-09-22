import { CANDIDATE_AI_TOOLS } from "@/lib/candidate-facts";
import type { CvWithEntries, JdAnalysis, RoleTrack } from "@/lib/types";

export type ExperienceCluster = "product" | "fullstack" | "frontend_saas";

export interface CanonicalRole {
  title: string;
  subtitle: string | null;
  date_label: string | null;
  description: string | null;
  bulletBank: string[];
  sourceTrack: RoleTrack;
  timelineKey: string;
  sortOrder: number;
}

const ANCHOR_EMPLOYERS: RegExp[] = [
  /gaming innovation|\bgig\b/i,
  /kenmore/i,
  /motor element/i,
  /netent/i,
];

const CLUSTER_EMPLOYERS: Record<ExperienceCluster, RegExp[]> = {
  product: [/kindred/i, /fdj/i],
  fullstack: [/momentum/i, /winnables/i],
  frontend_saas: [/tiugo|tiny(mce)?/i],
};

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export function resolveRoleTrack(jdAnalysis: JdAnalysis): RoleTrack {
  if (jdAnalysis.role_track) {
    return jdAnalysis.role_track;
  }
  return classifySourceRole(jdAnalysis.role_title);
}

export function resolveExperienceCluster(jdAnalysis: JdAnalysis): ExperienceCluster {
  const track = resolveRoleTrack(jdAnalysis);

  if (track === "product" || track === "engineering_management") {
    return "product";
  }

  const text = [
    jdAnalysis.role_title,
    jdAnalysis.domain,
    jdAnalysis.jd_summary,
    ...jdAnalysis.core_responsibilities,
    ...jdAnalysis.tech_stack,
    ...jdAnalysis.ats_keywords,
  ]
    .join(" ")
    .toLowerCase();

  if (
    /saas|frontend engineer|front-end engineer|cms|content platform|marketing site|design system|component library|headless cms|astro|gatsby|developer experience|dx engineer|public web platform/.test(
      text
    )
  ) {
    return "frontend_saas";
  }

  return "fullstack";
}

export function experienceClusterLabel(cluster: ExperienceCluster): string {
  switch (cluster) {
    case "product":
      return "Product / leadership";
    case "fullstack":
      return "Full-stack";
    case "frontend_saas":
      return "Frontend SaaS";
  }
}

export function classifySourceRole(title: string, subtitle?: string | null): RoleTrack {
  const text = `${title} ${subtitle ?? ""}`.toLowerCase();

  if (/product owner|product manager|technical product owner|\bpo\b/.test(text)) {
    return "product";
  }
  if (
    /engineering manager|head of engineering|director of engineering|head of\b|director of\b/.test(
      text
    )
  ) {
    return "engineering_management";
  }
  if (/project manager|web project manager|program manager/.test(text)) {
    return "product";
  }
  if (/developer|engineer|frontend|backend|full.?stack|software|wordpress/.test(text)) {
    return "engineering_ic";
  }
  return "other";
}

export function scoreBulletRelevance(bullet: string, jdAnalysis: JdAnalysis): number {
  const normalizedBullet = bullet.replace(/\*\*/g, "").toLowerCase();
  let score = 0;

  for (const phrase of collectJdPhrases(jdAnalysis)) {
    if (phrase.length < 3) continue;
    if (normalizedBullet.includes(phrase)) {
      score += phrase.includes(" ") ? 3 : 1;
    }
  }

  return score;
}

function collectJdPhrases(jdAnalysis: JdAnalysis): string[] {
  return [
    ...jdAnalysis.ats_keywords,
    ...jdAnalysis.must_have_requirements,
    ...jdAnalysis.core_responsibilities,
    ...jdAnalysis.tech_stack,
  ]
    .map((phrase) => phrase.toLowerCase().trim())
    .filter(Boolean);
}

export function buildCanonicalTimeline(sourceCvs: CvWithEntries[]): CanonicalRole[] {
  if (sourceCvs.length === 0) return [];

  const sortedCvs = [...sourceCvs].sort(
    (a, b) => new Date(b.cv.updated_at).getTime() - new Date(a.cv.updated_at).getTime()
  );
  const orderSource =
    sortedCvs.find((source) => source.cv.slug === "senior-full-stack-engineer") ?? sortedCvs[0];
  const orderIndex = new Map<string, number>();
  orderSource.entries
    .filter((entry) => entry.section === "experience")
    .sort((a, b) => a.item_order - b.item_order)
    .forEach((entry, index) => {
      orderIndex.set(timelineKey(entry.title, entry.subtitle, entry.date_label), index);
    });

  const roleMap = new Map<string, CanonicalRole>();

  for (const source of sortedCvs) {
    const experience = source.entries
      .filter((entry) => entry.section === "experience")
      .sort((a, b) => a.item_order - b.item_order);

    for (const entry of experience) {
      const key = timelineKey(entry.title, entry.subtitle, entry.date_label);
      const bullets = parseExperienceBullets(entry.description);
      const track = classifySourceRole(entry.title, entry.subtitle);
      const existing = roleMap.get(key);

      if (!existing) {
        roleMap.set(key, {
          title: entry.title.trim(),
          subtitle: entry.subtitle?.trim() || null,
          date_label: entry.date_label?.trim() || null,
          description: entry.description?.trim() || null,
          bulletBank: [...bullets],
          sourceTrack: track,
          timelineKey: key,
          sortOrder: orderIndex.get(key) ?? 999,
        });
        continue;
      }

      mergeBulletBank(existing, bullets);
    }
  }

  return Array.from(roleMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function selectExperienceTimeline(
  timeline: CanonicalRole[],
  jdAnalysis: JdAnalysis
): CanonicalRole[] {
  const cluster = resolveExperienceCluster(jdAnalysis);
  const clusterPatterns = CLUSTER_EMPLOYERS[cluster];
  const roleTrack = resolveRoleTrack(jdAnalysis);

  const anchors = pickAnchorRoles(timeline);
  const variableRoles = timeline.filter((role) => !isAnchorRole(role));

  const selectedVariable = dedupeByEmployer(
    variableRoles.filter((role) => matchesVariableRole(role, clusterPatterns, roleTrack)),
    roleTrack,
    jdAnalysis
  );

  const excluded = variableRoles.filter(
    (role) => !matchesVariableRole(role, clusterPatterns, roleTrack)
  );

  if (excluded.length > 0) {
    console.log("[generate-cv] Excluded post-NetEnt roles for cluster", {
      cluster,
      excluded: excluded.map((role) => ({
        title: role.title,
        subtitle: role.subtitle,
        date: role.date_label,
      })),
    });
  }

  return sortExperienceByRecency([...selectedVariable, ...anchors]);
}

function matchesVariableRole(
  role: CanonicalRole,
  clusterPatterns: RegExp[],
  roleTrack: RoleTrack
): boolean {
  if (!clusterPatterns.some((pattern) => pattern.test(employerText(role)))) {
    return false;
  }

  if (roleTrack === "product") {
    return role.sourceTrack === "product" || role.sourceTrack === "other";
  }

  if (roleTrack === "engineering_management") {
    return (
      role.sourceTrack === "engineering_management" || role.sourceTrack === "product"
    );
  }

  return true;
}

export function selectRolesForTrack(
  timeline: CanonicalRole[],
  _track: RoleTrack,
  jdAnalysis: JdAnalysis
): CanonicalRole[] {
  return selectExperienceTimeline(timeline, jdAnalysis);
}

function pickAnchorRoles(timeline: CanonicalRole[]): CanonicalRole[] {
  const anchors: CanonicalRole[] = [];

  for (const pattern of ANCHOR_EMPLOYERS) {
    const matches = timeline.filter((role) => pattern.test(employerText(role)));
    if (matches.length === 0) continue;
    anchors.push(pickBestRoleVariant(matches));
  }

  return sortTimeline(anchors, timeline);
}

function pickBestRoleVariant(roles: CanonicalRole[]): CanonicalRole {
  return [...roles].sort((a, b) => b.bulletBank.length - a.bulletBank.length)[0];
}

function dedupeByEmployer(
  roles: CanonicalRole[],
  track: RoleTrack,
  jdAnalysis: JdAnalysis | null
): CanonicalRole[] {
  const byEmployer = new Map<string, CanonicalRole[]>();

  for (const role of roles) {
    const key = employerKey(role);
    const group = byEmployer.get(key) ?? [];
    group.push(role);
    byEmployer.set(key, group);
  }

  return Array.from(byEmployer.values()).map((group) => {
    if (group.length === 1) {
      return group[0];
    }

    const sorted = [...group].sort((a, b) => {
      const trackDiff = trackPriority(b.sourceTrack, track) - trackPriority(a.sourceTrack, track);
      if (trackDiff !== 0) return trackDiff;

      if (jdAnalysis) {
        const relevanceDiff =
          averageBulletRelevance(b.bulletBank, jdAnalysis) -
          averageBulletRelevance(a.bulletBank, jdAnalysis);
        if (relevanceDiff !== 0) return relevanceDiff;
      }

      return b.bulletBank.length - a.bulletBank.length;
    });

    const winner = sorted[0];
    const duplicates = sorted.slice(1);
    return mergeSameEmployerVariants(winner, duplicates, jdAnalysis);
  });
}

function mergeSameEmployerVariants(
  winner: CanonicalRole,
  duplicates: CanonicalRole[],
  jdAnalysis: JdAnalysis | null
): CanonicalRole {
  if (duplicates.length === 0) {
    return winner;
  }

  const mergedBullets = jdAnalysis
    ? rankBullets(
        [...winner.bulletBank, ...duplicates.flatMap((role) => role.bulletBank)],
        jdAnalysis
      )
    : [...winner.bulletBank, ...duplicates.flatMap((role) => role.bulletBank)];

  return {
    ...winner,
    bulletBank: mergedBullets,
    description: mergedBullets.join("\n"),
  };
}

function averageBulletRelevance(bullets: string[], jdAnalysis: JdAnalysis): number {
  if (bullets.length === 0) return 0;
  return bullets.reduce((sum, bullet) => sum + scoreBulletRelevance(bullet, jdAnalysis), 0) / bullets.length;
}

export const EXPERIENCE_BULLET_WRITING_RULES = [
  "Experience bullets must read like a polished CV shown to a hiring manager — concise achievement statements only.",
  "Never discuss coverage, gaps, missing skills, transferability, or how well the candidate matches the JD.",
  "Forbidden in experience bullets: \"does not establish\", \"not established\", \"rather than\", \"without claiming\", \"transferable to\", \"relevant to the requirement\", quoting JD requirements, or comparing the role to the job posting.",
  "Do not put candidate location (city/country/EU-based) inside experience bullets — location belongs in the CV header only.",
  "Each bullet: one strong statement of what was owned, delivered, or achieved. Use **bold** for 1-3 key phrases. Max ~35 words per bullet.",
].join("\n");

export function buildSystemPrompt(
  track: RoleTrack,
  timeline: CanonicalRole[],
  cluster: ExperienceCluster
): string {
  const timelineLines = timeline.map((role) => {
    const employer = role.subtitle?.trim();
    const dates = role.date_label?.trim();
    const parts = [role.title, employer, dates].filter(Boolean);
    return `- ${parts.join(" — ")}`;
  });

  const sharedRules = [
    "You are an expert CV writer. You tailor one CV for a specific job using ONLY facts from the candidate's existing CVs and the provided skill pool.",
    "",
    "Rules:",
    "- Never invent employers, job titles they did not hold, degrees, projects, metrics, team sizes, or achievements that do not appear in the source CVs.",
    "- You MUST rewrite the summary and every experience bullet. Do not copy bullets verbatim from the source CVs.",
    "- The summary MUST be 3-5 sentences, open with the JD role title, and explicitly address the top three must_have_requirements using jd_summary as the brief.",
    "- Write the summary as a confident hiring-manager pitch. Never mention missing skills, gaps, or what the candidate has not done.",
    `- Mention daily use of ${CANDIDATE_AI_TOOLS.join(", ")} in the summary and in at least one post-NetEnt experience bullet.`,
    "- Experience: 6-8 bullets per role (every role in the output). Reframe real work in the JD's vocabulary and ATS keywords.",
    "- Post-NetEnt roles (non-anchor employers in the timeline) are the primary JD keyword targets: every must_have_requirement and ats_keyword should appear in at least one post-NetEnt bullet.",
    "- On post-NetEnt roles only, weave JD vocabulary (product vision, roadmap, use cases, concept through to production, business outcomes, governance, validation, security, Agentic AI, LLMs, RAG, prompt engineering, guardrails, evaluation) into descriptions of real work at that employer.",
    "- Do not invent new employers, titles, date ranges, metrics, or team sizes. Anchor roles (NetEnt and earlier) stay closer to source facts.",
    "- The output experience timeline must include ONLY these roles — do not add, remove, merge, or combine employers:",
    ...timelineLines,
    "- Never merge separate employers or concurrent roles into one entry. Each employer in the list above must remain its own experience item.",
    "- List experience in reverse chronological order (most recent role first).",
    "- Experience descriptions must use this markdown-ish format: each bullet on its own line starting with \"- \", and **bold** for emphasis.",
    ...EXPERIENCE_BULLET_WRITING_RULES.split("\n").map((line) => `- ${line}`),
    "- Dates: use date_label strings from source CVs. Do not invent employers or date ranges. Avoid overlapping full-time roles — contractor entries (subtitle contains \"Contractor\") may run alongside other work.",
    "- If candidate location is provided, use it in summary and coverage only for location requirements (e.g. EU-based). Malta is in the EU. Never put location in experience bullets.",
    "- coverage: score the tailored CV text. JD vocabulary in post-NetEnt bullets counts as partial or strong when it reflects adjacent real work.",
    "- target_role should match the job posting title, or the closest honest fit from the candidate's experience.",
    "- title is an admin label for this tailored version (the target role, or \"Company – Role\" if a company is provided).",
  ];

  const trackRules = trackExperienceRules(track, cluster);
  const skillsRule = trackSkillsRule(track);

  return [...sharedRules, trackRules, skillsRule].join("\n");
}

export function roleTrackLabel(track: RoleTrack): string {
  switch (track) {
    case "engineering_ic":
      return "Engineering (IC)";
    case "product":
      return "Product";
    case "engineering_management":
      return "Engineering management";
    default:
      return "General";
  }
}

export function coverLetterPersona(track: RoleTrack): string {
  switch (track) {
    case "product":
      return "You are an expert cover letter writer for senior product leaders and product owners.";
    case "engineering_management":
      return "You are an expert cover letter writer for engineering managers and technical leaders.";
    case "other":
      return "You are an expert cover letter writer for experienced professionals.";
    default:
      return "You are an expert cover letter writer for senior software engineers.";
  }
}

function trackExperienceRules(track: RoleTrack, cluster: ExperienceCluster): string {
  const clusterHint = clusterExperienceHint(cluster);

  switch (track) {
    case "product":
      return [
        clusterHint,
        "- Experience emphasis: lead with product ownership, discovery, product vision, roadmap, use-case identification, stakeholder alignment, concept through to production, and AI/agentic product strategy.",
        "- In post-NetEnt roles, at least 6 bullets MUST each contain a phrase from ats_keywords, must_have_requirements, or core_responsibilities.",
        "- At least half of the bullets in other roles MUST map to a core_responsibility or must_have_requirement.",
      ].join("\n");
    case "engineering_management":
      return [
        clusterHint,
        "- Experience emphasis: lead with people leadership, delivery ownership, technical direction, hiring/mentoring, and cross-functional stakeholder management.",
        "- At least half of the bullets in the post-NetEnt roles MUST map to a core_responsibility or must_have_requirement.",
      ].join("\n");
    case "other":
      return [
        clusterHint,
        "- At least half of the bullets in the post-NetEnt roles MUST map to a core_responsibility or must_have_requirement.",
      ].join("\n");
    default:
      return [
        clusterHint,
        "- Experience emphasis: lead with hands-on engineering impact, architecture, delivery, and technical ownership.",
        "- At least half of the bullets in the post-NetEnt roles MUST map to a core_responsibility or must_have_requirement.",
      ].join("\n");
  }
}

function clusterExperienceHint(cluster: ExperienceCluster): string {
  switch (cluster) {
    case "product":
      return "- Post-NetEnt emphasis: highlight Kindred Group product ownership experience. Do not include Engineering Manager roles, Momentum, Winnables, or Tiugo/TinyMCE.";
    case "fullstack":
      return "- Post-NetEnt emphasis: highlight Momentum Group and Winnables full-stack delivery experience. Do not include Kindred, FDJ, or Tiugo/TinyMCE roles.";
    case "frontend_saas":
      return "- Post-NetEnt emphasis: highlight Tiugo/TinyMCE frontend SaaS platform experience. Do not include Kindred, FDJ, Momentum, or Winnables roles.";
  }
}

function trackSkillsRule(track: RoleTrack): string {
  if (track === "engineering_ic") {
    return "- Skills: build 5-7 categories whose names mirror the JD stack headings (e.g. \"Real-time Communication & Messaging\", \"Infrastructure & Orchestration\"). Order categories by JD relevance. Fill each category ONLY from the skill pool and source CV skills. Never invent a skill that is not in the pool or source CVs. Omit JD tech_stack items with no pool match.\n- Skills: \"title\" is the category name; \"description\" is a comma-separated list (no bullets).";
  }

  return "- Skills: build 5-7 categories whose names mirror JD practice areas (e.g. \"Product Discovery & Delivery\", \"Agentic AI & Automation\") rather than only tech stack headings. Order categories by JD relevance. Fill each category ONLY from the skill pool and source CV skills. Never invent a skill that is not in the pool or source CVs.\n- Skills: \"title\" is the category name; \"description\" is a comma-separated list (no bullets).";
}

function trackPriority(roleTrack: RoleTrack, targetTrack: RoleTrack): number {
  if (roleTrack === targetTrack) return 4;
  if (targetTrack === "product" && roleTrack === "engineering_management") return 3;
  if (targetTrack === "engineering_management" && roleTrack === "product") return 3;
  if (targetTrack === "engineering_ic" && roleTrack === "engineering_ic") return 2;
  if (roleTrack === "other") return 1;
  return 0;
}

export function rankBullets(bullets: string[], jdAnalysis: JdAnalysis): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const bullet of bullets) {
    const key = normalizeBullet(bullet);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(bullet);
  }

  return unique.sort(
    (a, b) => scoreBulletRelevance(b, jdAnalysis) - scoreBulletRelevance(a, jdAnalysis)
  );
}

function mergeBulletBank(role: CanonicalRole, bullets: string[]): void {
  const seen = new Set(role.bulletBank.map(normalizeBullet));
  for (const bullet of bullets) {
    const key = normalizeBullet(bullet);
    if (seen.has(key)) continue;
    role.bulletBank.push(bullet);
    seen.add(key);
  }
}

export function isAnchorRole(role: CanonicalRole): boolean {
  return ANCHOR_EMPLOYERS.some((pattern) => pattern.test(employerText(role)));
}

export function selectPostNetEntRoles(timeline: CanonicalRole[]): CanonicalRole[] {
  return timeline.filter((role) => !isAnchorRole(role));
}

export function buildKeywordTargetingBrief(
  postNetEntRoles: CanonicalRole[],
  jdAnalysis: JdAnalysis
): string {
  const roleLines = postNetEntRoles.map((role) => {
    const parts = [role.title, role.subtitle, role.date_label].filter(Boolean);
    return `- ${parts.join(" — ")}`;
  });

  return [
    "Post-NetEnt keyword targeting — rewrite these roles with natural CV bullets that include JD vocabulary:",
    ...(roleLines.length > 0 ? roleLines : ["- (none selected)"]),
    "",
    EXPERIENCE_BULLET_WRITING_RULES,
    "",
    "Weave the phrases below into normal achievement bullets. Do NOT quote requirements or explain fit — just write the work as if the candidate already speaks the JD's language.",
    "Do NOT invent employers, titles, dates, metrics, or team sizes.",
    "",
    "Must-have requirements:",
    ...jdAnalysis.must_have_requirements.map((requirement) => `- ${requirement}`),
    "",
    "ATS keywords:",
    jdAnalysis.ats_keywords.join(", ") || "(none)",
    "",
    "Core responsibilities to mirror:",
    ...jdAnalysis.core_responsibilities.map((responsibility) => `- ${responsibility}`),
  ].join("\n");
}

function employerText(role: CanonicalRole): string {
  return (role.subtitle ?? role.title).trim();
}

function employerKey(role: CanonicalRole): string {
  return employerText(role).toLowerCase() || role.timelineKey;
}

function timelineKey(title: string, subtitle: string | null, dateLabel: string | null): string {
  const employer = (subtitle ?? "").trim().toLowerCase();
  const dates = normalizeDateLabel(dateLabel);
  const roleTitle = title.trim().toLowerCase();
  return `${employer}::${dates}::${roleTitle}`;
}

function normalizeDateLabel(dateLabel: string | null): string {
  return (dateLabel ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[–—]/g, "-")
    .trim();
}

function sortTimeline(roles: CanonicalRole[], reference: CanonicalRole[]): CanonicalRole[] {
  const order = new Map(reference.map((role, index) => [role.timelineKey, index]));
  return [...roles].sort(
    (a, b) => (order.get(a.timelineKey) ?? 999) - (order.get(b.timelineKey) ?? 999)
  );
}

export function sortExperienceByRecency(roles: CanonicalRole[]): CanonicalRole[] {
  return [...roles].sort((a, b) => {
    const startDiff =
      parseExperienceStartSortKey(b.date_label) - parseExperienceStartSortKey(a.date_label);
    if (startDiff !== 0) return startDiff;

    const endDiff =
      parseExperienceEndSortKey(b.date_label) - parseExperienceEndSortKey(a.date_label);
    if (endDiff !== 0) return endDiff;

    return a.sortOrder - b.sortOrder;
  });
}

function parseExperienceStartSortKey(dateLabel: string | null): number {
  const parsed = parseDatePart(dateLabel, "start");
  if (!parsed) return 0;
  return parsed.year * 12 + parsed.month;
}

function parseExperienceEndSortKey(dateLabel: string | null): number {
  const normalized = normalizeDateLabel(dateLabel);
  if (normalized.includes("present") || normalized.includes("current")) {
    return Number.MAX_SAFE_INTEGER;
  }

  const parsed = parseDatePart(dateLabel, "end");
  if (!parsed) return 0;
  return parsed.year * 12 + parsed.month;
}

function parseDatePart(
  dateLabel: string | null,
  part: "start" | "end"
): { year: number; month: number } | null {
  if (!dateLabel) return null;

  const segments = normalizeDateLabel(dateLabel)
    .split("-")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const target = part === "start" ? segments[0] : segments[segments.length - 1];
  if (!target || target === "present" || target === "current") {
    return part === "end" ? { year: 9999, month: 12 } : null;
  }

  const match = target.match(/([a-z]+)\s+(\d{4})/i);
  if (!match) return null;

  return {
    year: Number.parseInt(match[2], 10),
    month: MONTH_INDEX[match[1].toLowerCase()] ?? 1,
  };
}

export function parseExperienceBullets(description: string | null): string[] {
  if (!description) return [];
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ") || line.startsWith("•"))
    .map((line) => (line.startsWith("- ") ? line : `- ${line.replace(/^•\s*/, "")}`));
}

export function normalizeBullet(bullet: string): string {
  return bullet.replace(/\*\*/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeEmployer(subtitle: string | null, title: string): string {
  return (subtitle ?? title)
    .replace(/\s*\(contractor\)\s*/gi, "")
    .trim()
    .toLowerCase();
}

export function toGeneratedExperience(role: CanonicalRole): {
  title: string;
  subtitle: string | null;
  date_label: string | null;
  description: string | null;
} {
  return {
    title: role.title,
    subtitle: role.subtitle,
    date_label: role.date_label,
    description: role.description,
  };
}
