import { createSupabaseServerClient } from "@/lib/supabase";
import type { CoverLetter, CoverLetterWithCv, Cv } from "@/lib/types";

export async function getPublicCoverLetters(): Promise<CoverLetter[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("cover_letters")
    .select("*")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as CoverLetter[];
}

export async function getAllCoverLetters(): Promise<CoverLetter[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("cover_letters")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data as CoverLetter[];
}

export async function getCoverLetterById(id: number): Promise<CoverLetterWithCv | null> {
  const client = createSupabaseServerClient();
  if (!client) return null;

  const { data: coverLetter, error } = await client
    .from("cover_letters")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !coverLetter) return null;

  let cv: Cv | null = null;
  if (coverLetter.cv_id) {
    const { data: cvData } = await client.from("cvs").select("*").eq("id", coverLetter.cv_id).single();
    cv = cvData as Cv | null;
  }

  return { coverLetter: coverLetter as CoverLetter, cv };
}

export async function getPublicCoverLetterBySlug(slug: string): Promise<CoverLetterWithCv | null> {
  const client = createSupabaseServerClient();
  if (!client) return null;

  const { data: coverLetter, error } = await client
    .from("cover_letters")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (error || !coverLetter) return null;

  let cv: Cv | null = null;
  if (coverLetter.cv_id) {
    const { data: cvData } = await client.from("cvs").select("*").eq("id", coverLetter.cv_id).single();
    cv = cvData as Cv | null;
  }

  return { coverLetter: coverLetter as CoverLetter, cv };
}
