import { NextRequest, NextResponse } from "next/server";
import { getAllCvsWithEntries } from "@/lib/cv-data";
import {
  buildGeneratedEntries,
  generateTailoredCv,
  normalizeGeneratedSlug,
} from "@/lib/generate-cv";
import { ensureUniqueSlug } from "@/lib/cv-pdf";
import { createSupabaseServerClient } from "@/lib/supabase";

export const maxDuration = 60;

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
  const timelineNotes = readString(body, "timelineNotes");

  if (!jobDescription) {
    return NextResponse.json({ error: "Job description is required." }, { status: 400 });
  }

  const sourceCvs = await getAllCvsWithEntries();
  if (sourceCvs.length === 0) {
    return NextResponse.json(
      { error: "Create at least one CV before generating a tailored version." },
      { status: 400 }
    );
  }

  let generated;
  try {
    generated = await generateTailoredCv({
      jobDescription,
      companyName,
      timelineNotes,
      sourceCvs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate CV.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const client = createSupabaseServerClient();
  if (!client) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const identity = sourceCvs[0].cv;
  const uniqueSlug = ensureUniqueSlug(
    normalizeGeneratedSlug(generated.slug || generated.target_role || generated.title),
    sourceCvs.map((source) => source.cv.slug),
    "tailored"
  );
  const title = companyName
    ? `${companyName} – ${generated.target_role.trim()}`
    : generated.title.trim() || generated.target_role.trim();

  const { data: newCv, error: cvError } = await client
    .from("cvs")
    .insert({
      title,
      slug: uniqueSlug,
      target_role: generated.target_role.trim(),
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
    })
    .select("*")
    .single();

  if (cvError || !newCv) {
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
      return NextResponse.json({ error: entriesError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ id: newCv.id });
}

function readString(body: unknown, key: string): string {
  if (!body || typeof body !== "object" || !(key in body)) {
    return "";
  }

  const value = (body as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}
