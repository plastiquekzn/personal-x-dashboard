const FALLBACK_BUCKET = "tweet-screenshots";
const FALLBACK_GEMINI_MODEL = "gemini-2.5-flash";
const FALLBACK_GEMINI_FALLBACK_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_GEMINI_METRICS_MODEL = "gemini-2.5-flash-lite";

export function getAppEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    bucket: process.env.NEXT_PUBLIC_SUPABASE_BUCKET ?? FALLBACK_BUCKET,
    geminiApiKey: process.env.GEMINI_API_KEY ?? "",
    geminiModel: process.env.GEMINI_MODEL ?? FALLBACK_GEMINI_MODEL,
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? FALLBACK_GEMINI_FALLBACK_MODEL,
    geminiMetricsModel: process.env.GEMINI_METRICS_MODEL ?? FALLBACK_GEMINI_METRICS_MODEL
  };
}

export function isSupabaseConfigured() {
  const env = getAppEnv();
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
}

export function isGeminiConfigured() {
  const env = getAppEnv();
  return Boolean(env.geminiApiKey);
}
