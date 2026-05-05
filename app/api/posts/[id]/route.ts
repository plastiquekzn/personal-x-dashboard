import { NextResponse } from "next/server";
import { z } from "zod";

import { getAppEnv, isSupabaseConfigured } from "@/lib/env";
import { createPostFingerprint } from "@/lib/fingerprint";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

const updatePostSchema = z.object({
  projectId: z.string().uuid(),
  tweetUrl: z.string().trim().optional().or(z.literal("")),
  postText: z.string().trim().optional().or(z.literal("")),
  summary: z.string().trim().optional().or(z.literal("")),
  postedAt: z.string().trim().optional().or(z.literal("")),
  repliesCount: z.string().trim().optional().or(z.literal("")),
  repostsCount: z.string().trim().optional().or(z.literal("")),
  likesCount: z.string().trim().optional().or(z.literal("")),
  viewsCount: z.string().trim().optional().or(z.literal(""))
});

function normalizeUpdatedRawExtraction(rawText: string | null, payload: z.infer<typeof updatePostSchema>) {
  const parsedReplies = payload.repliesCount ? Number.parseInt(payload.repliesCount, 10) : null;
  const parsedReposts = payload.repostsCount ? Number.parseInt(payload.repostsCount, 10) : null;
  const parsedLikes = payload.likesCount ? Number.parseInt(payload.likesCount, 10) : null;
  const parsedViews = payload.viewsCount ? Number.parseInt(payload.viewsCount, 10) : null;

  const reviewSnapshot = {
    post_text: payload.postText || null,
    summary: payload.summary || null,
    posted_at: payload.postedAt || null,
    replies_count: Number.isFinite(parsedReplies) ? parsedReplies : null,
    reposts_count: Number.isFinite(parsedReposts) ? parsedReposts : null,
    likes_count: Number.isFinite(parsedLikes) ? parsedLikes : null,
    views_count: Number.isFinite(parsedViews) ? parsedViews : null
  };

  try {
    const parsed = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};

    return JSON.stringify(
      {
        ...parsed,
        review_snapshot: reviewSnapshot
      },
      null,
      2
    );
  } catch {
    return JSON.stringify(
      {
        review_snapshot: reviewSnapshot,
        raw_text: rawText || null
      },
      null,
      2
    );
  }
}

export async function PATCH(request: Request, { params }: RouteProps) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is unavailable." }, { status: 500 });
  }

  const { id } = await params;
  const parsed = updatePostSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Submitted post update is invalid." }, { status: 400 });
  }

  const payload = parsed.data;
  const repliesCount = payload.repliesCount ? Number.parseInt(payload.repliesCount, 10) : null;
  const repostsCount = payload.repostsCount ? Number.parseInt(payload.repostsCount, 10) : null;
  const likesCount = payload.likesCount ? Number.parseInt(payload.likesCount, 10) : null;
  const viewsCount = payload.viewsCount ? Number.parseInt(payload.viewsCount, 10) : null;

  const { data: existingPost, error: fetchError } = await supabase
    .from("posts")
    .select("id, ocr_raw_text")
    .eq("id", id)
    .single();

  if (fetchError || !existingPost) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("posts")
    .update({
      project_id: payload.projectId,
      tweet_url: payload.tweetUrl || null,
      post_text: payload.postText || null,
      posted_at: payload.postedAt || null,
      replies_count: Number.isFinite(repliesCount) ? repliesCount : null,
      reposts_count: Number.isFinite(repostsCount) ? repostsCount : null,
      likes_count: Number.isFinite(likesCount) ? likesCount : null,
      views_count: Number.isFinite(viewsCount) ? viewsCount : null,
      ocr_raw_text: normalizeUpdatedRawExtraction(existingPost.ocr_raw_text, payload),
      content_fingerprint: createPostFingerprint(payload.postText ?? "", payload.postedAt ?? "") || null
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ id }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: RouteProps) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();
  const env = getAppEnv();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is unavailable." }, { status: 500 });
  }

  const { id } = await params;

  const { data: post, error: fetchError } = await supabase
    .from("posts")
    .select("id, screenshot_path")
    .eq("id", id)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase.from("posts").delete().eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (post.screenshot_path) {
    const { error: storageError } = await supabase.storage.from(env.bucket).remove([post.screenshot_path]);

    if (storageError) {
      console.warn("Post deleted but screenshot cleanup failed.", storageError);
    }
  }

  return new NextResponse(null, { status: 204 });
}
