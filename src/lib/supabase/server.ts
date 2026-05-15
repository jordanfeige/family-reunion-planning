import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

const globalForSupabase = globalThis as unknown as {
  admin: SupabaseClient | undefined;
};

/** Server-only Supabase client (service role). Use in Server Components, Actions, and Route Handlers. */
export function createSupabaseAdmin(): SupabaseClient {
  if (!globalForSupabase.admin) {
    globalForSupabase.admin = createClient(
      getSupabaseUrl(),
      getSupabaseServiceRoleKey(),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
  }
  return globalForSupabase.admin;
}
