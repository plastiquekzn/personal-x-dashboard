import type { PostRecord } from "@/lib/types";

type ParsedExtractionPayload = {
  review_snapshot?: {
    summary?: string;
  };
  extraction?: {
    summary?: string;
  };
};

function safeParseExtraction(rawText: string | null) {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as ParsedExtractionPayload;
  } catch {
    return null;
  }
}

function truncateWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);

  if (words.length <= maxWords) {
    return words.join(" ");
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function buildFallbackSummary(text: string | null) {
  if (!text) {
    return "Summary pending";
  }

  const normalizedLines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (normalizedLines.length === 0) {
    return "Summary pending";
  }

  if (normalizedLines.length === 1) {
    return truncateWords(normalizedLines[0], 18);
  }

  const joined = normalizedLines.slice(0, 2).join(" ");
  return truncateWords(joined, 18);
}

export function getPostSummary(post: Pick<PostRecord, "ocr_raw_text" | "post_text">) {
  const parsed = safeParseExtraction(post.ocr_raw_text);
  const reviewSummary = parsed?.review_snapshot?.summary?.trim();

  if (reviewSummary) {
    return reviewSummary;
  }

  const extractionSummary = parsed?.extraction?.summary?.trim();

  if (extractionSummary) {
    return extractionSummary;
  }

  return buildFallbackSummary(post.post_text);
}
