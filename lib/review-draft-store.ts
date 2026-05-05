import type { ExtractionDraft } from "@/lib/types";

let reviewDraft: ExtractionDraft | null = null;

export function setReviewDraft(draft: ExtractionDraft) {
  reviewDraft = draft;
}

export function getReviewDraft() {
  return reviewDraft;
}

export function clearReviewDraft() {
  reviewDraft = null;
}
