export type ProjectRecord = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
};

export type PostRecord = {
  id: string;
  project_id: string;
  tweet_url: string | null;
  post_text: string | null;
  posted_at: string | null;
  replies_count: number | null;
  reposts_count: number | null;
  likes_count: number | null;
  views_count: number | null;
  screenshot_path: string;
  screenshot_width: number | null;
  screenshot_height: number | null;
  ocr_raw_text: string | null;
  ocr_confidence: "low" | "medium" | "high";
  content_fingerprint: string | null;
  created_at: string;
  updated_at: string;
  project?: Pick<ProjectRecord, "id" | "name" | "slug" | "color" | "logo_path" | "logo_url"> | null;
};

export type DashboardSummary = {
  totalPosts: number;
  totalProjects: number;
  postsThisMonth: number;
};

export type ExtractionDraft = {
  projectId: string;
  tweetUrl: string;
  summary: string;
  postText: string;
  postedAt: string;
  repliesCount: string;
  repostsCount: string;
  likesCount: string;
  viewsCount: string;
  ocrRawText: string;
  ocrConfidence: "low" | "medium" | "high";
  screenshotDataUrl: string;
  screenshotMimeType: string;
  screenshotName: string;
  screenshotWidth: number;
  screenshotHeight: number;
};

export type ParsedOcrResult = {
  postText: string;
  summary: string;
  postedAt: string;
  repliesCount: string;
  repostsCount: string;
  likesCount: string;
  viewsCount: string;
  ocrRawText: string;
  ocrConfidence: "low" | "medium" | "high";
};
