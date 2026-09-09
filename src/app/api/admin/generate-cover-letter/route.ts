import { NextRequest, NextResponse } from "next/server";
import { getCvById } from "@/lib/cv-data";
import { normalizeGeneratedSlug } from "@/lib/generate-cv";
import { buildCoverLetterSlugBase, generateCoverLetter } from "@/lib/generate-cover-letter";
import { ensureUniqueSlug } from "@/lib/cv-pdf";
import { getAllCoverLetters } from "@/lib/cover-letter-data";
import { createSupabaseServerClient } from "@/lib/supabase";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const token = request.cookies.get("admin_token")?.value;
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const cvId = readCvId(body);
  if (!cvId) {
    return NextResponse.json({ error: "cvId is required." }, { status: 400 });
  }

  const requestStartedAt = Date.now();
  console.log("[generate-cover-letter] Request started", { cvId });

  const cvData = await getCvById(cvId);
  if (!cvData) {
    return NextResponse.json({ error: "CV not found." }, { status: 404 });
  }

  const { cv, entries } = cvData;

  if (!cv.job_description?.trim()) {
    return NextResponse.json(
      { error: "This CV has no stored job description. Generate the CV from a JD first." },
      { status: 400 }
    );
  }

  const companyName =
    cv.company_name?.trim() || cv.jd_analysis?.company_name?.trim() || "";
  const roleTitle = cv.target_role?.trim() || cv.jd_analysis?.role_title?.trim() || "";

  if (!companyName) {
    return NextResponse.json(
      { error: "Could not resolve company name for this CV." },
      { status: 400 }
    );
  }

  if (!roleTitle) {
    return NextResponse.json(
      { error: "Could not resolve role title for this CV." },
      { status: 400 }
    );
  }

  let generated;
  try {
    generated = await generateCoverLetter({
      cv,
      entries,
      jobDescription: cv.job_description,
      jdAnalysis: cv.jd_analysis,
      companyName,
      roleTitle,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate cover letter.";
    console.error("[generate-cover-letter] Generation failed", { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const client = createSupabaseServerClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const existingLetters = await getAllCoverLetters();
  const slugBase = buildCoverLetterSlugBase(roleTitle, companyName);
  const uniqueSlug = ensureUniqueSlug(
    normalizeGeneratedSlug(slugBase),
    existingLetters.map((letter) => letter.slug)
  );

  const { data: newLetter, error: insertError } = await client
    .from("cover_letters")
    .insert({
      cv_id: cv.id,
      slug: uniqueSlug,
      role: roleTitle,
      company_name: companyName,
      body: generated.body,
      is_public: false,
    })
    .select("id")
    .single();

  if (insertError || !newLetter) {
    console.error("[generate-cover-letter] Failed to save letter", { error: insertError?.message });
    return NextResponse.json(
      { error: insertError?.message ?? "Could not save cover letter." },
      { status: 500 }
    );
  }

  console.log("[generate-cover-letter] Request complete", {
    durationMs: Date.now() - requestStartedAt,
    coverLetterId: newLetter.id,
    slug: uniqueSlug,
    cvId: cv.id,
  });

  return NextResponse.json({ id: newLetter.id });
}

function readCvId(body: unknown): number | null {
  if (!body || typeof body !== "object" || !("cvId" in body)) {
    return null;
  }

  const value = (body as Record<string, unknown>).cvId;
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return null;
}
