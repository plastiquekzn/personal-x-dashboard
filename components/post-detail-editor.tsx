"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { fromDateTimeInputValue, formatCompactNumber, toDateTimeInputValue } from "@/lib/format";
import { getPostSummary } from "@/lib/post-presentation";
import type { PostRecord, ProjectRecord } from "@/lib/types";

type PostDetailEditorProps = {
  post: PostRecord;
  projects: ProjectRecord[];
  screenshotUrl: string;
};

type EditablePostState = {
  projectId: string;
  tweetUrl: string;
  postText: string;
  summary: string;
  postedAt: string;
  repliesCount: string;
  repostsCount: string;
  likesCount: string;
  viewsCount: string;
};

function toEditableState(post: PostRecord): EditablePostState {
  return {
    projectId: post.project_id,
    tweetUrl: post.tweet_url ?? "",
    postText: post.post_text ?? "",
    summary: getPostSummary(post),
    postedAt: post.posted_at ?? "",
    repliesCount: post.replies_count === null ? "" : String(post.replies_count),
    repostsCount: post.reposts_count === null ? "" : String(post.reposts_count),
    likesCount: post.likes_count === null ? "" : String(post.likes_count),
    viewsCount: post.views_count === null ? "" : String(post.views_count)
  };
}

export function PostDetailEditor({ post, projects, screenshotUrl }: PostDetailEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [draft, setDraft] = useState<EditablePostState>(() => toEditableState(post));
  const [errorMessage, setErrorMessage] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleSave() {
    setErrorMessage("");

    const response = await fetch(`/api/posts/${post.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draft)
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setErrorMessage(payload?.error ?? "Failed to save the post.");
      return;
    }

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleDelete() {
    const shouldDelete = window.confirm("Delete this post from the dashboard?");

    if (!shouldDelete) {
      return;
    }

    setErrorMessage("");
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Failed to delete the post.");
        return;
      }

      startTransition(() => {
        router.push("/");
        router.refresh();
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Saved post</p>
            <h2>{post.project?.name ?? "Unknown project"}</h2>
            <p>Edit the saved record, fix metrics, or remove the post from the dashboard.</p>
          </div>
          <div className="action-group">
            <button type="button" className="button" disabled={isPending || isDeleting} onClick={handleSave}>
              {isPending ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="button-danger" disabled={isPending || isDeleting} onClick={handleDelete}>
              {isDeleting ? "Deleting..." : "Delete Post"}
            </button>
          </div>
        </div>

        <div className="split-layout">
          <div className="preview-frame">
            {screenshotUrl ? (
              <img src={screenshotUrl} alt="Saved tweet screenshot" />
            ) : (
              <div className="empty-state">
                <h3>Screenshot unavailable</h3>
                <p>Check your bucket name and service role key if the image did not load.</p>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="field">
              <label htmlFor="detailProject">Project</label>
              <select
                id="detailProject"
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
              <label htmlFor="detailUrl">Tweet URL</label>
              <input
                id="detailUrl"
                type="url"
                value={draft.tweetUrl}
                onChange={(event) => setDraft({ ...draft, tweetUrl: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="detailSummary">Summary</label>
              <textarea
                id="detailSummary"
                className="textarea-compact"
                value={draft.summary}
                onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
              />
            </div>

            <div className="field">
              <label htmlFor="detailText">Post Text</label>
              <textarea
                id="detailText"
                value={draft.postText}
                onChange={(event) => setDraft({ ...draft, postText: event.target.value })}
              />
            </div>

            <div className="metric-grid metric-grid-wide">
              <div className="field">
                <label htmlFor="detailDate">Posted At</label>
                <input
                  id="detailDate"
                  type="datetime-local"
                  value={toDateTimeInputValue(draft.postedAt)}
                  onChange={(event) => setDraft({ ...draft, postedAt: fromDateTimeInputValue(event.target.value) })}
                />
              </div>

              <div className="field">
                <label htmlFor="detailReplies">Replies</label>
                <input
                  id="detailReplies"
                  inputMode="numeric"
                  value={draft.repliesCount}
                  onChange={(event) =>
                    setDraft({ ...draft, repliesCount: event.target.value.replace(/[^\d]/g, "") })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="detailReposts">Reposts</label>
                <input
                  id="detailReposts"
                  inputMode="numeric"
                  value={draft.repostsCount}
                  onChange={(event) =>
                    setDraft({ ...draft, repostsCount: event.target.value.replace(/[^\d]/g, "") })
                  }
                />
              </div>

              <div className="field">
                <label htmlFor="detailLikes">Likes</label>
                <input
                  id="detailLikes"
                  inputMode="numeric"
                  value={draft.likesCount}
                  onChange={(event) => setDraft({ ...draft, likesCount: event.target.value.replace(/[^\d]/g, "") })}
                />
              </div>

              <div className="field">
                <label htmlFor="detailViews">Views</label>
                <input
                  id="detailViews"
                  inputMode="numeric"
                  value={draft.viewsCount}
                  onChange={(event) => setDraft({ ...draft, viewsCount: event.target.value.replace(/[^\d]/g, "") })}
                />
              </div>
            </div>

            <div className="metric-strip">
              <div className="subtle-box">
                <strong>Replies</strong>
                <p>{formatCompactNumber(post.replies_count)}</p>
              </div>
              <div className="subtle-box">
                <strong>Reposts</strong>
                <p>{formatCompactNumber(post.reposts_count)}</p>
              </div>
              <div className="subtle-box">
                <strong>Likes</strong>
                <p>{formatCompactNumber(post.likes_count)}</p>
              </div>
              <div className="subtle-box">
                <strong>Views</strong>
                <p>{formatCompactNumber(post.views_count)}</p>
              </div>
            </div>

            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
          </div>
        </div>
      </section>
    </main>
  );
}
