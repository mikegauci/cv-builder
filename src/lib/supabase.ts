import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const isConfigured = Boolean(url && key);

function createBrowserClient(): SupabaseClient {
  if (!isConfigured) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(url, key);
}

let cachedClient: SupabaseClient | null = null;

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!cachedClient) {
      cachedClient = createBrowserClient();
    }

    const value = (cachedClient as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(cachedClient) : value;
  },
});

export function createSupabaseServerClient() {
  if (!isConfigured) {
    return null;
  }

  return createClient(url, key);
}
