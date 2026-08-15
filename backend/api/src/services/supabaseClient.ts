import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env";

// --- Admin client (service role key) — bypasses RLS ---
// Use ONLY for write operations, cross-user queries, storage, and admin tasks.
let cachedAdminClient: SupabaseClient | null = null;

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  cachedAdminClient = createClient(
    env.supabaseUrl,
    env.supabaseServiceRoleKey,
    {
      auth: {
        persistSession: false,
      },
    },
  );

  return cachedAdminClient;
};

// --- Regular client (anon key) — respects RLS ---
// Use for read-only operations that should be scoped by RLS policies.
let cachedAnonClient: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (cachedAnonClient) {
    return cachedAnonClient;
  }

  cachedAnonClient = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });

  return cachedAnonClient;
};
