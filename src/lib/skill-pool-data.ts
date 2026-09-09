import { createSupabaseServerClient } from "@/lib/supabase";
import type { SkillPoolItem } from "@/lib/types";

export async function getSkillPool(): Promise<SkillPoolItem[]> {
  const client = createSupabaseServerClient();
  if (!client) return [];

  const { data, error } = await client
    .from("skill_pool")
    .select("*")
    .order("category")
    .order("item_order");

  if (error || !data) {
    return [];
  }

  return data as SkillPoolItem[];
}
