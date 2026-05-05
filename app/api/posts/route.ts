import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createPostFingerprint } from "@/lib/fingerprint";
import { getAppEnv, isSupabaseConfigured } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const postPayloadSchema = z.object({
  projectId: z.string().uuid(),
  tweetUrl: z.string().trim().optional().or(z.literal("")),
  postText: z.string().trim().optional().or(z.literal("")),
  summary: z.string().trim().optional().or(z.literal("")),
  postedAt: z.string().trim().optional().or(z.literal("")),
  repliesCount: z.string().trim().optional().or(z.literal("")),
  repostsCount: z.string().trim().optional().or(z.literal("")),
  likesCount: z.string().trim().optional().or(z.literal("")),
  viewsCount: z.string().trim().optional().or(z.literal("")),
  ocrRawText: z.string().trim().optional().or(z.literal("")),
  ocrConfidence: z.enum(["low", "medium", "high"]),
  screenshotWidth: z.coerce.number().int().positive().optional(),
  screenshotHeight: z.coerce.number().int().positive().optional()
});

function buildFallbackSummary(text: string) {
  const words = text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) {
    return "Summary pending";
  }

  if (words.length <= 18) {
    return words.join(" ");
  }

  return `${words.slice(0, 18).join(" ")}...`;
}

function normalizeRawExtraction(rawText: string, payload: z.infer<typeof postPayloadSchema>) {
  const parsedReplies = payload.repliesCount ? Number.parseInt(payload.repliesCount, 10) : null;
  const parsedReposts = payload.repostsCount ? Number.parseInt(payload.repostsCount, 10) : null;
  const parsedLikes = payload.likesCount ? Number.parseInt(payload.likesCount, 10) : null;
  const parsedViews = payload.viewsCount ? Number.parseInt(payload.viewsCount, 10) : null;

  let summary = payload.summary?.trim() ?? "";

  try {
    const parsed = JSON.parse(rawText) as {
      extraction?: {
        summary?: string;
      };
    };

    summary = summary || parsed.extraction?.summary?.trim() || "";

    return JSON.stringify(
      {
        ...parsed,
        review_snapshot: {
          post_text: payload.postText || null,
          summary: summary || buildFallbackSummary(payload.postText || ""),
          posted_at: payload.postedAt || null,
          replies_count: Number.isFinite(parsedReplies) ? parsedReplies : null,
          reposts_count: Number.isFinite(parsedReposts) ? parsedReposts : null,
          likes_count: Number.isFinite(parsedLikes) ? parsedLikes : null,
          views_count: Number.isFinite(parsedViews) ? parsedViews : null
        }
      },
      null,
      2
    );
  } catch {
    return JSON.stringify(
      {
        review_snapshot: {
          post_text: payload.postText || null,
          summary: summary || buildFallbackSummary(payload.postText || ""),
          posted_at: payload.postedAt || null,
          replies_count: Number.isFinite(parsedReplies) ? parsedReplies : null,
          reposts_count: Number.isFinite(parsedReposts) ? parsedReposts : null,
          likes_count: Number.isFinite(parsedLikes) ? parsedLikes : null,
          views_count: Number.isFinite(parsedViews) ? parsedViews : null
        },
        raw_text: rawText || null
      },
      null,
      2
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = getSupabaseAdmin();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase admin client is unavailable." }, { status: 500 });
  }

  const formData = await request.formData();
  const screenshot = formData.get("screenshot");

  if (!(screenshot instanceof File)) {
    return NextResponse.json({ error: "Screenshot file is required." }, { status: 400 });
  }

  const parsed = postPayloadSchema.safeParse({
    projectId: formData.get("projectId"),
    tweetUrl: formData.get("tweetUrl"),
    postText: formData.get("postText"),
    summary: formData.get("summary"),
    postedAt: formData.get("postedAt"),
    repliesCount: formData.get("repliesCount"),
    repostsCount: formData.get("repostsCount"),
    likesCount: formData.get("likesCount"),
    viewsCount: formData.get("viewsCount"),
    ocrRawText: formData.get("ocrRawText"),
    ocrConfidence: formData.get("ocrConfidence"),
    screenshotWidth: formData.get("screenshotWidth"),
    screenshotHeight: formData.get("screenshotHeight")
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Submitted post data is invalid." }, { status: 400 });
  }

  const payload = parsed.data;
  const env = getAppEnv();
  const extension = screenshot.name.split(".").pop()?.toLowerCase() || "png";
  const today = new Date();
  const storagePath = `posts/${today.getUTCFullYear()}/${String(today.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${extension}`;
  const fileBuffer = await screenshot.arrayBuffer();

  const uploadResult = await supabase.storage.from(env.bucket).upload(storagePath, fileBuffer, {
    contentType: screenshot.type || "image/png",
    upsert: false
  });

  if (uploadResult.error) {
    return NextResponse.json({ error: uploadResult.error.message }, { status: 500 });
  }

  const fingerprint = createPostFingerprint(payload.postText ?? "", payload.postedAt ?? "");
  const repliesCount = payload.repliesCount ? Number.parseInt(payload.repliesCount, 10) : null;
  const repostsCount = payload.repostsCount ? Number.parseInt(payload.repostsCount, 10) : null;
  const likesCount = payload.likesCount ? Number.parseInt(payload.likesCount, 10) : null;
  const viewsCount = payload.viewsCount ? Number.parseInt(payload.viewsCount, 10) : null;
  const normalizedRawExtraction = normalizeRawExtraction(payload.ocrRawText || "", payload);

  const { data, error } = await supabase
    .from("posts")
    .insert({
      project_id: payload.projectId,
      tweet_url: payload.tweetUrl || null,
      post_text: payload.postText || null,
      posted_at: payload.postedAt || null,
      replies_count: Number.isFinite(repliesCount) ? repliesCount : null,
      reposts_count: Number.isFinite(repostsCount) ? repostsCount : null,
      likes_count: Number.isFinite(likesCount) ? likesCount : null,
      views_count: Number.isFinite(viewsCount) ? viewsCount : null,
      screenshot_path: storagePath,
      screenshot_width: payload.screenshotWidth ?? null,
      screenshot_height: payload.screenshotHeight ?? null,
      ocr_raw_text: normalizedRawExtraction,
      ocr_confidence: payload.ocrConfidence,
      content_fingerprint: fingerprint || null
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This tweet already appears to be saved." }, { status: 409 });
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
