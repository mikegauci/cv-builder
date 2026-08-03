import { createSupabaseServerClient } from "@/lib/supabase";
import type { Cv, CvEntry, CvWithEntries } from "@/lib/types";

export async function getPublicCvs(): Promise<Cv[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];
  const { data, error } = await client
    .from("cvs")
    .select("*")
    .eq("is_public", true)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as Cv[];
}

export async function getAllCvs(): Promise<Cv[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];
  const { data, error } = await client.from("cvs").select("*").order("updated_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as Cv[];
}

export async function getCvById(cvId: number): Promise<CvWithEntries | null> {
  const client = createSupabaseServerClient();
  if (!client) return null;

  const [{ data: cv, error: cvError }, { data: entries, error: entriesError }] = await Promise.all([
    client.from("cvs").select("*").eq("id", cvId).single(),
    client.from("cv_entries").select("*").eq("cv_id", cvId).order("section").order("item_order"),
  ]);

  if (cvError || !cv || entriesError || !entries) {
    return null;
  }

  return {
    cv: cv as Cv,
    entries: entries as CvEntry[],
  };
}

export async function getPublicCvBySlug(slug: string): Promise<CvWithEntries | null> {
  const client = createSupabaseServerClient();
  if (!client) return null;

  const { data: cv, error: cvError } = await client
    .from("cvs")
    .select("*")
    .eq("slug", slug)
    .eq("is_public", true)
    .single();

  if (cvError || !cv) {
    return null;
  }

  const { data: entries, error: entriesError } = await client
    .from("cv_entries")
    .select("*")
    .eq("cv_id", cv.id)
    .order("section")
    .order("item_order");

  if (entriesError || !entries) {
    return null;
  }

  return {
    cv: cv as Cv,
    entries: entries as CvEntry[],
  };
}
