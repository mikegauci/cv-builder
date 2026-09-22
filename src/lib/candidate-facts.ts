export const CANDIDATE_AI_TOOLS = [
  "Claude Code",
  "Claude Design",
  "Cursor AI",
  "AI-assisted apps",
] as const;

export function buildCandidateFactsBrief(): string {
  const tools = CANDIDATE_AI_TOOLS.join(", ");

  return [
    "Candidate facts (always include in tailored CVs):",
    `- Uses ${tools} in daily product and delivery work.`,
    "- Mention these tools in the summary and in at least one post-NetEnt experience bullet where they support AI, product, or technical delivery credibility.",
    "- Include them in a relevant skills category (e.g. Agentic AI & Productivity or AI-Assisted Delivery).",
  ].join("\n");
}
