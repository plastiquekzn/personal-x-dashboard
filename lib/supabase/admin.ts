import { createClient } from "@supabase/supabase-js";

import { getAppEnv } from "@/lib/env";

export function getSupabaseAdmin() {
  const env = getAppEnv();

  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return null;
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
