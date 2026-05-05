import { getAppEnv } from "@/lib/env";
import { attachProjectLogoUrls } from "@/lib/data/project-assets";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DashboardSummary, PostRecord } from "@/lib/types";

function buildPostsSelect(includeReposts: boolean) {
  return `
        id,
        project_id,
        tweet_url,
        post_text,
        posted_at,
        replies_count,
        ${includeReposts ? "reposts_count," : ""}
        likes_count,
        views_count,
        screenshot_path,
        screenshot_width,
        screenshot_height,
        ocr_raw_text,
        ocr_confidence,
        content_fingerprint,
        created_at,
        updated_at,
        project:projects (*)
      `;
}

function normalizePostRecord(record: Record<string, unknown>) {
  const rawProject = Array.isArray(record.project) ? record.project[0] : record.project;

  return {
    ...record,
    reposts_count:
      typeof record.reposts_count === "number" || record.reposts_count === null ? record.reposts_count : null,
    project: rawProject ?? null
  } as PostRecord;
}

function shouldRetryWithoutReposts(error: { code?: string; message?: string } | null) {
  return error?.code === "42703" && /reposts_count/i.test(error?.message ?? "");
}

export async function getPosts(limit?: number) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return [] satisfies PostRecord[];
  }

  const client = supabase;

  async function runQuery(includeReposts: boolean) {
    let query = client
      .from("posts")
      .select(buildPostsSelect(includeReposts))
      .order("posted_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (typeof limit === "number") {
      query = query.limit(limit);
    }

    return query;
  }

  let { data, error } = await runQuery(true);

  if (shouldRetryWithoutReposts(error)) {
    ({ data, error } = await runQuery(false));
  }

  if (error) {
    console.error("Failed to load posts", error);
    return [] satisfies PostRecord[];
  }

  const normalized = (data ?? []).map((record) => normalizePostRecord(record as unknown as Record<string, unknown>));
  const projectsWithLogos = await attachProjectLogoUrls(
    normalized.map((post) => post.project).filter(Boolean) as NonNullable<PostRecord["project"]>[]
  );
  const projectMap = new Map(projectsWithLogos.map((project) => [project.id, project]));

  return normalized.map((post) => ({
    ...post,
    project: post.project ? projectMap.get(post.project.id) ?? post.project : null
  }));
}

export async function getPostById(postId: string) {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return null;
  }

  const client = supabase;

  async function runQuery(includeReposts: boolean) {
    return client
      .from("posts")
      .select(buildPostsSelect(includeReposts))
      .eq("id", postId)
      .single();
  }

  let { data, error } = await runQuery(true);

  if (shouldRetryWithoutReposts(error)) {
    ({ data, error } = await runQuery(false));
  }

  if (error) {
    console.error("Failed to load post", error);
    return null;
  }

  const normalized = normalizePostRecord(data as unknown as Record<string, unknown>);
  const [projectWithLogo] = await attachProjectLogoUrls(
    normalized.project ? [normalized.project as NonNullable<PostRecord["project"]>] : []
  );

  return {
    ...normalized,
    project: projectWithLogo ?? normalized.project
  };
}

export async function getDashboardSummary() {
  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return {
      totalPosts: 0,
      totalProjects: 0,
      postsThisMonth: 0
    } satisfies DashboardSummary;
  }

  const [{ count: totalPosts }, { count: totalProjects }] = await Promise.all([
    supabase.from("posts").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true })
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const { count: postsThisMonth } = await supabase
    .from("posts")
    .select("*", { count: "exact", head: true })
    .gte("created_at", monthStart.toISOString());

  return {
    totalPosts: totalPosts ?? 0,
    totalProjects: totalProjects ?? 0,
    postsThisMonth: postsThisMonth ?? 0
  } satisfies DashboardSummary;
}

export async function getSignedScreenshotUrl(path: string) {
  const supabase = getSupabaseAdmin();
  const env = getAppEnv();

  if (!supabase) {
    return "";
  }

  const { data, error } = await supabase.storage.from(env.bucket).createSignedUrl(path, 60 * 60);

  if (error) {
    console.error("Failed to create signed screenshot URL", error);
    return "";
  }

  return data.signedUrl;
}
