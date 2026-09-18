import { NextRequest, NextResponse } from "next/server";
import { getAllCvsWithEntries } from "@/lib/cv-data";
import {
  buildGeneratedEntries,
  buildGeneratedSlugBase,
  buildGeneratedTitle,
  generateTailoredCv,
  normalizeGeneratedSlug,
} from "@/lib/generate-cv";
import { analyseJobDescription, resolveCompanyName } from "@/lib/jd-analysis";
import { resolveCvIdentity } from "@/lib/cv-identity";
import { filterMasterSourceCvs } from "@/lib/master-cvs";
import { ensureUniqueSlug } from "@/lib/cv-pdf";
import { getSkillPool } from "@/lib/skill-pool-data";
import { createSupabaseServerClient } from "@/lib/supabase";

export const maxDuration = 300;

const MAX_JOB_DESCRIPTION_LENGTH = 30_000;

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

  const jobDescription = readString(body, "jobDescription");
  const companyName = readString(body, "companyName");

  if (!jobDescription) {
    return NextResponse.json({ error: "Job description is required." }, { status: 400 });
  }

  if (jobDescription.length > MAX_JOB_DESCRIPTION_LENGTH) {
    return NextResponse.json(
      { error: `Job description must be ${MAX_JOB_DESCRIPTION_LENGTH} characters or fewer.` },
      { status: 400 }
    );
  }

  const requestStartedAt = Date.now();
  console.log("[generate-cv] Request started", {
    jdLength: jobDescription.length,
    companyName: companyName || null,
  });

  const allCvs = await getAllCvsWithEntries();
  if (allCvs.length === 0) {
    return NextResponse.json(
      { error: "Create at least one CV before generating a tailored version." },
      { status: 400 }
    );
  }

  const sourceCvs = filterMasterSourceCvs(allCvs);
  const identity = resolveCvIdentity(allCvs);

  let jdAnalysis;
  try {
    jdAnalysis = await analyseJobDescription({
      jobDescription,
      companyName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not analyse job description.";
    console.error("[generate-cv] Stage 1 failed", { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const resolvedCompanyName = resolveCompanyName(companyName, jdAnalysis);
  const skillPool = await getSkillPool();
  console.log("[generate-cv] Loaded inputs", {
    totalCvCount: allCvs.length,
    masterCvCount: sourceCvs.length,
    masterCvTitles: sourceCvs.map((source) => source.cv.title),
    skillPoolCount: skillPool.length,
    resolvedCompanyName,
  });

  let generated;
  try {
    generated = await generateTailoredCv({
      jobDescription,
      companyName: resolvedCompanyName ?? "",
      sourceCvs,
      jdAnalysis,
      skillPool,
      candidateLocation: {
        city: identity.city,
        country: identity.country,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate CV.";
    console.error("[generate-cv] Stage 2 failed", { error: message });
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const client = createSupabaseServerClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const targetRole = generated.target_role.trim();
  const title = buildGeneratedTitle(targetRole, resolvedCompanyName);
  const slugBase = buildGeneratedSlugBase(targetRole, resolvedCompanyName, generated.slug);
  const uniqueSlug = ensureUniqueSlug(
    normalizeGeneratedSlug(slugBase),
    allCvs.map((source) => source.cv.slug)
  );

  const { data: newCv, error: cvError } = await client
    .from("cvs")
    .insert({
      title,
      slug: uniqueSlug,
      target_role: targetRole,
      summary: generated.summary.trim(),
      full_name: identity.full_name,
      profile_image_url: identity.profile_image_url,
      email: identity.email,
      phone: identity.phone,
      city: identity.city,
      country: identity.country,
      linkedin: identity.linkedin,
      github: identity.github,
      website: identity.website,
      is_public: false,
      company_name: resolvedCompanyName,
      job_description: jobDescription,
      jd_analysis: jdAnalysis,
      jd_coverage: generated.coverage,
    })
    .select("*")
    .single();

  if (cvError || !newCv) {
    console.error("[generate-cv] Failed to save CV", { error: cvError?.message });
    return NextResponse.json({ error: cvError?.message ?? "Could not save generated CV." }, { status: 500 });
  }

  const entries = buildGeneratedEntries(generated, sourceCvs).map((entry) => ({
    ...entry,
    cv_id: newCv.id,
  }));

  if (entries.length > 0) {
    const { error: entriesError } = await client.from("cv_entries").insert(entries);
    if (entriesError) {
      await client.from("cvs").delete().eq("id", newCv.id);
      console.error("[generate-cv] Failed to save entries, rolled back CV", {
        cvId: newCv.id,
        error: entriesError.message,
      });
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }
  }

  console.log("[generate-cv] Request complete", {
    durationMs: Date.now() - requestStartedAt,
    cvId: newCv.id,
    title,
    slug: uniqueSlug,
    entryCount: entries.length,
    coverage: generated.coverage.map((item) => ({
      requirement: item.requirement,
      status: item.status,
    })),
  });

  return NextResponse.json({ id: newCv.id });
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== "object" || !(key in body)) {
    return "";
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}
