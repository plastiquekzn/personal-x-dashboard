"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { dataUrlToFile } from "@/lib/ocr/client-image";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/format";
import { clearReviewDraft, getReviewDraft } from "@/lib/review-draft-store";
import type { ExtractionDraft, ProjectRecord } from "@/lib/types";

type ReviewPostWorkspaceProps = {
  projects: ProjectRecord[];
};

export function ReviewPostWorkspace({ projects }: ReviewPostWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<ExtractionDraft | null>(() => getReviewDraft());
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSave() {
    if (!draft) {
      return;
    }

    setErrorMessage("");

    try {
      const formData = new FormData();
      const screenshotFile = dataUrlToFile(draft.screenshotDataUrl, draft.screenshotName, draft.screenshotMimeType);

      formData.append("projectId", draft.projectId);
      formData.append("tweetUrl", draft.tweetUrl);
      formData.append("postText", draft.postText);
      formData.append("summary", draft.summary);
      formData.append("postedAt", draft.postedAt);
      formData.append("repliesCount", draft.repliesCount);
      formData.append("repostsCount", draft.repostsCount);
      formData.append("likesCount", draft.likesCount);
      formData.append("viewsCount", draft.viewsCount);
      formData.append("ocrRawText", draft.ocrRawText);
      formData.append("ocrConfidence", draft.ocrConfidence);
      formData.append("screenshotWidth", String(draft.screenshotWidth));
      formData.append("screenshotHeight", String(draft.screenshotHeight));
      formData.append("screenshot", screenshotFile);

      const response = await fetch("/api/posts", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string; id?: string };

      if (!response.ok || !payload.id) {
        setErrorMessage(payload.error ?? "Failed to save the post.");
        return;
      }

      clearReviewDraft();

      startTransition(() => {
        router.push(`/posts/${payload.id}`);
      });
    } catch (error) {
      console.error(error);
      setErrorMessage("Saving failed. Check your Supabase environment variables and bucket setup.");
    }
  }

  if (!draft) {
    return (
      <div className="page">
        <section className="empty-state">
          <h2>No extraction draft found</h2>
          <p>Go back to Add Post, upload a screenshot, and run extraction first.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Step 2</p>
            <h2>Review Extraction</h2>
            <p>Fix anything that looks off before the record is written to the database.</p>
          </div>
          <div className="pill">Confidence: {draft.ocrConfidence}</div>
        </div>

        <div className="split-layout">
          <div className="preview-frame">
            <img src={draft.screenshotDataUrl} alt="Tweet screenshot preview" />
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="reviewProject">Project</label>
              <select
                id="reviewProject"
                value={draft.projectId}
                onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="reviewUrl">Tweet URL</label>
              <input
                id="reviewUrl"
                type="url"
                value={draft.tweetUrl}
                onChange={(event) => setDraft({ ...draft, tweetUrl: event.target.value })}
                placeholder="Optional source URL"
              />
            </div>

            <div className="field">
              <label htmlFor="reviewSummary">Summary</label>
              <textarea
                id="reviewSummary"
                className="textarea-compact"
                value={draft.summary}
                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="reviewText">Post Text</label>
              <textarea
                id="reviewText"
                value={draft.postText}
                onChange={(event) => setDraft({ ...draft, postText: event.target.value })}
              />
            </div>

            <div className="metric-grid">
              <div className="field">
                <label htmlFor="reviewDate">Posted At</label>
                <input
                  id="reviewDate"
                  type="datetime-local"
                  value={toDateTimeInputValue(draft.postedAt)}
                  onChange={(event) => setDraft({ ...draft, postedAt: fromDateTimeInputValue(event.target.value) })}
                />
              </div>

              <div className="field">
                <label htmlFor="reviewReplies">Replies</label>
                <input
                  id="reviewReplies"
                  inputMode="numeric"
                  value={draft.repliesCount}
                  onChange={(event) =>
                    setDraft({ ...draft, repliesCount: event.target.value.replace(/[^\d]/g, "") })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="reviewReposts">Reposts</label>
                <input
                  id="reviewReposts"
                  inputMode="numeric"
                  value={draft.repostsCount}
                  onChange={(event) =>
                    setDraft({ ...draft, repostsCount: event.target.value.replace(/[^\d]/g, "") })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="reviewLikes">Likes</label>
                <input
                  id="reviewLikes"
                  inputMode="numeric"
                  value={draft.likesCount}
                  onChange={(event) => setDraft({ ...draft, likesCount: event.target.value.replace(/[^\d]/g, "") })}
                />
              </div>

              <div className="field">
                <label htmlFor="reviewViews">Views</label>
                <input
                  id="reviewViews"
                  inputMode="numeric"
                  value={draft.viewsCount}
                  onChange={(event) => setDraft({ ...draft, viewsCount: event.target.value.replace(/[^\d]/g, "") })}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="ocrText">Raw Extraction JSON</label>
              <textarea
                id="ocrText"
                value={draft.ocrRawText}
                onChange={(event) => setDraft({ ...draft, ocrRawText: event.target.value })}
              />
              <span className="field-hint">Keep this stored for debugging AI extraction misses later.</span>
            </div>

            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

            <div className="action-row grid-two">
              <button type="button" className="button" disabled={isPending} onClick={handleSave}>
                {isPending ? "Saving..." : "Save Post"}
              </button>
              <button type="button" className="button-ghost" onClick={() => router.push("/posts/new")}>
                Back To Upload
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
