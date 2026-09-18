import OpenAI from "openai";
import { getOpenAiModel, getOpenAiTemperature } from "@/lib/openai-model";
import type { JdAnalysis } from "@/lib/types";

const SYSTEM_PROMPT = `You are an expert recruiter and technical hiring analyst.
Extract structured requirements from a job description.
Be precise and concise. Use the employer's own wording where possible.
If the company name is not explicit, return null for company_name.
Do not invent requirements that are not supported by the posting.
Set role_track from the primary function of the role, not the technologies mentioned — e.g. "Agentic AI Product Owner" is product even when the posting emphasises AI tooling.`;

const jdAnalysisJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    company_name: { type: ["string", "null"] },
    role_title: { type: "string" },
    seniority_level: { type: "string" },
    domain: { type: "string" },
    jd_summary: { type: "string" },
    must_have_requirements: {
      type: "array",
      items: { type: "string" },
    },
    nice_to_haves: {
      type: "array",
      items: { type: "string" },
    },
    core_responsibilities: {
      type: "array",
      items: { type: "string" },
    },
    tech_stack: {
      type: "array",
      items: { type: "string" },
    },
    ats_keywords: {
      type: "array",
      items: { type: "string" },
    },
    role_track: {
      type: "string",
      enum: ["engineering_ic", "product", "engineering_management", "other"],
    },
  },
  required: [
    "company_name",
    "role_title",
    "seniority_level",
    "domain",
    "jd_summary",
    "must_have_requirements",
    "nice_to_haves",
    "core_responsibilities",
    "tech_stack",
    "ats_keywords",
    "role_track",
  ],
} as const;

export interface AnalyseJobDescriptionInput {
  jobDescription: string;
  companyName?: string;
}

export async function analyseJobDescription(
  input: AnalyseJobDescriptionInput
): Promise<JdAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const model = getOpenAiModel();
  const companyHint = input.companyName
    ? `The applicant provided this company name: ${input.companyName}. Prefer it unless the JD clearly names a different employer.`
    : "No company name was provided by the applicant.";

  console.log("[generate-cv] Stage 1: analysing job description", {
    model,
    jdLength: input.jobDescription.length,
    companyName: input.companyName || null,
  });
  const startedAt = Date.now();

  const temperature = getOpenAiTemperature(model, 0.2);

  const completion = await openai.chat.completions.create({
    model,
    ...(temperature !== undefined ? { temperature } : {}),
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          companyHint,
          "",
          "Job description:",
          input.jobDescription,
        ].join("\n"),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "jd_analysis",
        strict: true,
        schema: jdAnalysisJsonSchema,
      },
    },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned an empty JD analysis.");
  }

  const parsed = JSON.parse(content) as JdAnalysis;
  if (!parsed.role_title?.trim() || !parsed.jd_summary?.trim()) {
    throw new Error("OpenAI returned an incomplete JD analysis.");
  }

  if (input.companyName?.trim() && !parsed.company_name?.trim()) {
    parsed.company_name = input.companyName.trim();
  }

  console.log("[generate-cv] Stage 1 complete", {
    durationMs: Date.now() - startedAt,
    company: parsed.company_name,
    role: parsed.role_title,
    roleTrack: parsed.role_track,
    domain: parsed.domain,
    mustHaves: parsed.must_have_requirements.length,
    responsibilities: parsed.core_responsibilities.length,
    techStack: parsed.tech_stack.length,
    usage: completion.usage,
  });

  return parsed;
}

export function resolveCompanyName(
  formCompanyName: string,
  analysis: JdAnalysis
): string | null {
  const fromForm = formCompanyName.trim();
  if (fromForm) return fromForm;
  const fromAnalysis = analysis.company_name?.trim();
  return fromAnalysis || null;
}
