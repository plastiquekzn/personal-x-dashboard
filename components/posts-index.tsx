"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDeferredValue, useEffect, useState, useTransition } from "react";

import { dataUrlToFile } from "@/lib/ocr/client-image";
import { fromDateTimeInputValue, formatCompactNumber, formatDateOnly, formatTimeOnly, toDateTimeInputValue } from "@/lib/format";
import { getPostSummary } from "@/lib/post-presentation";
import type { ExtractionDraft, PostRecord, ProjectRecord } from "@/lib/types";

type PostsIndexProps = {
  posts: PostRecord[];
  projects: ProjectRecord[];
};

type SortKey = "posted_at" | "replies_count" | "reposts_count" | "likes_count" | "views_count";
type SortDirection = "asc" | "desc";
type QuickCaptureStep = "capture" | "review";

function getSortValue(post: PostRecord, sortKey: SortKey) {
  switch (sortKey) {
    case "replies_count":
      return post.replies_count ?? -1;
    case "likes_count":
      return post.likes_count ?? -1;
    case "reposts_count":
      return post.reposts_count ?? -1;
    case "views_count":
      return post.views_count ?? -1;
    case "posted_at":
    default:
      return Date.parse(post.posted_at ?? post.created_at) || 0;
  }
}

function sortPosts(posts: PostRecord[], sortKey: SortKey, sortDirection: SortDirection) {
  return [...posts].sort((left, right) => {
    const leftValue = getSortValue(left, sortKey);
    const rightValue = getSortValue(right, sortKey);

    return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
  });
}

function getSortArrow(isActive: boolean, direction: SortDirection) {
  if (!isActive) {
    return "↕";
  }

  return direction === "asc" ? "↑" : "↓";
}

export function PostsIndex({ posts, projects }: PostsIndexProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("posted_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [captureStep, setCaptureStep] = useState<QuickCaptureStep>("capture");
  const [captureProjectId, setCaptureProjectId] = useState("");
  const [captureTweetUrl, setCaptureTweetUrl] = useState("");
  const [captureDraft, setCaptureDraft] = useState<ExtractionDraft | null>(null);
  const [captureErrorMessage, setCaptureErrorMessage] = useState("");
  const [isCapturingUrl, setIsCapturingUrl] = useState(false);
  const [isSavingQuickCapture, setIsSavingQuickCapture] = useState(false);
  const [openActionsPostId, setOpenActionsPostId] = useState("");
  const deferredQuery = useDeferredValue(query);

  const visiblePosts = posts.filter((post) => !deletedIds.includes(post.id));
  const normalizedQuery = deferredQuery.trim().toLowerCase();

  const filteredPosts = sortPosts(
    visiblePosts.filter((post) => {
      const matchesProject = projectId === "all" || post.project_id === projectId;

      if (!matchesProject) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const haystack = [getPostSummary(post), post.post_text, post.project?.name, post.tweet_url]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    }),
    sortKey,
    sortDirection
  );

  useEffect(() => {
    if (!openActionsPostId) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Element && target.closest("[data-actions-menu='true']")) {
        return;
      }

      setOpenActionsPostId("");
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenActionsPostId("");
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [openActionsPostId]);

  function getFriendlyExtractionError(message?: string) {
    if (!message) {
      return "Capture failed.";
    }

    if (message.includes("Quota exceeded") || message.includes("RESOURCE_EXHAUSTED")) {
      return "Gemini free tier limit is hit right now. Wait a bit and try again.";
    }

    if (message.includes("currently experiencing high demand") || message.includes("\"code\": 503")) {
      return "Gemini is overloaded right now. Retry in a minute and try again.";
    }

    return message;
  }

  function resetCaptureState() {
    setCaptureProjectId("");
    setCaptureTweetUrl("");
    setCaptureDraft(null);
    setCaptureErrorMessage("");
    setCaptureStep("capture");
  }

  function openCaptureModal() {
    resetCaptureState();
    setIsModalOpen(true);
  }

  function closeCaptureModal() {
    if (isCapturingUrl || isSavingQuickCapture || isPending) {
      return;
    }

    setIsModalOpen(false);
    resetCaptureState();
  }

  function handleSort(nextSortKey: SortKey) {
    if (sortKey === nextSortKey) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortKey(nextSortKey);
    setSortDirection("desc");
  }

  async function handleDelete(post: PostRecord) {
    const shouldDelete = window.confirm("Delete this post from the dashboard?");

    if (!shouldDelete) {
      return;
    }

    setErrorMessage("");
    setDeletingId(post.id);
    setOpenActionsPostId("");

    try {
      const response = await fetch(`/api/posts/${post.id}`, {
        method: "DELETE"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setErrorMessage(payload?.error ?? "Failed to delete the post.");
        return;
      }

      setDeletedIds((current) => [...current, post.id]);
    } catch (error) {
      console.error(error);
      setErrorMessage("Delete failed. Try again in a few seconds.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleUrlCapture() {
    if (!captureProjectId) {
      setCaptureErrorMessage("Pick a project before capturing the tweet.");
      return;
    }

    if (!captureTweetUrl.trim()) {
      setCaptureErrorMessage("Paste a tweet URL before capturing the tweet.");
      return;
    }

    setCaptureErrorMessage("");
    setIsCapturingUrl(true);

    try {
      const response = await fetch("/api/extract-from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tweetUrl: captureTweetUrl })
      });

      const payload = (await response.json()) as {
        error?: string;
        postText?: string;
        summary?: string;
        postedAt?: string;
        repliesCount?: string;
        repostsCount?: string;
        likesCount?: string;
        viewsCount?: string;
        confidence?: "low" | "medium" | "high";
        rawText?: string;
        screenshotDataUrl?: string;
        screenshotMimeType?: string;
        screenshotName?: string;
        screenshotWidth?: number;
        screenshotHeight?: number;
        tweetUrl?: string;
      };

      if (!response.ok) {
        setCaptureErrorMessage(getFriendlyExtractionError(payload.error));
        return;
      }

      setCaptureDraft({
        projectId: captureProjectId,
        tweetUrl: payload.tweetUrl ?? captureTweetUrl,
        summary: payload.summary ?? "",
        postText: payload.postText ?? "",
        postedAt: payload.postedAt ?? "",
        repliesCount: payload.repliesCount ?? "",
        repostsCount: payload.repostsCount ?? "",
        likesCount: payload.likesCount ?? "",
        viewsCount: payload.viewsCount ?? "",
        ocrRawText: payload.rawText ?? "",
        ocrConfidence: payload.confidence ?? "medium",
        screenshotDataUrl: payload.screenshotDataUrl ?? "",
        screenshotMimeType: payload.screenshotMimeType ?? "image/png",
        screenshotName: payload.screenshotName ?? "tweet-url-capture.png",
        screenshotWidth: payload.screenshotWidth ?? 0,
        screenshotHeight: payload.screenshotHeight ?? 0
      });
      setCaptureStep("review");
    } catch (error) {
      console.error(error);
      setCaptureErrorMessage("URL capture failed. Try another tweet URL or retry in a few seconds.");
    } finally {
      setIsCapturingUrl(false);
    }
  }

  async function handleQuickSave() {
    if (!captureDraft) {
      return;
    }

    setCaptureErrorMessage("");
    setIsSavingQuickCapture(true);

    try {
      const formData = new FormData();
      const screenshotFile = dataUrlToFile(
        captureDraft.screenshotDataUrl,
        captureDraft.screenshotName,
        captureDraft.screenshotMimeType
      );

      formData.append("projectId", captureDraft.projectId);
      formData.append("tweetUrl", captureDraft.tweetUrl);
      formData.append("postText", captureDraft.postText);
      formData.append("summary", captureDraft.summary);
      formData.append("postedAt", captureDraft.postedAt);
      formData.append("repliesCount", captureDraft.repliesCount);
      formData.append("repostsCount", captureDraft.repostsCount);
      formData.append("likesCount", captureDraft.likesCount);
      formData.append("viewsCount", captureDraft.viewsCount);
      formData.append("ocrRawText", captureDraft.ocrRawText);
      formData.append("ocrConfidence", captureDraft.ocrConfidence);
      formData.append("screenshotWidth", String(captureDraft.screenshotWidth));
      formData.append("screenshotHeight", String(captureDraft.screenshotHeight));
      formData.append("screenshot", screenshotFile);

      const response = await fetch("/api/posts", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; id?: string } | null;

      if (!response.ok) {
        setCaptureErrorMessage(payload?.error ?? "Failed to save the post.");
        return;
      }

      closeCaptureModal();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      console.error(error);
      setCaptureErrorMessage("Save failed. Try again in a few seconds.");
    } finally {
      setIsSavingQuickCapture(false);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Search and clean up</p>
            <h2>All Posts</h2>
            <p>Click table headers to sort by date or performance, then remove bad records right from the list.</p>
          </div>
          <button type="button" className="button" onClick={openCaptureModal}>
            Add Post
          </button>
        </div>

        <div className="filter-row grid-two">
          <div className="field">
            <label htmlFor="search">Search</label>
            <input
              id="search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by summary, text, or URL"
            />
          </div>

          <div className="field">
            <label htmlFor="project">Project</label>
            <select id="project" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              <option value="all">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
      </section>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th>
              <th>Summary</th>
              <th className="table-center">
                <button
                  type="button"
                  className={sortKey === "posted_at" ? "table-sort active" : "table-sort"}
                  onClick={() => handleSort("posted_at")}
                >
                  Date {getSortArrow(sortKey === "posted_at", sortDirection)}
                </button>
              </th>
              <th className="table-center">
                <button
                  type="button"
                  className={sortKey === "posted_at" ? "table-sort active" : "table-sort"}
                  onClick={() => handleSort("posted_at")}
                >
                  Time {getSortArrow(sortKey === "posted_at", sortDirection)}
                </button>
              </th>
              <th className="table-center">
                <button
                  type="button"
                  className={sortKey === "replies_count" ? "table-sort active" : "table-sort"}
                  onClick={() => handleSort("replies_count")}
                >
                  Replies {getSortArrow(sortKey === "replies_count", sortDirection)}
                </button>
              </th>
              <th className="table-center">
                <button
                  type="button"
                  className={sortKey === "reposts_count" ? "table-sort active" : "table-sort"}
                  onClick={() => handleSort("reposts_count")}
                >
                  Reposts {getSortArrow(sortKey === "reposts_count", sortDirection)}
                </button>
              </th>
              <th className="table-center">
                <button
                  type="button"
                  className={sortKey === "likes_count" ? "table-sort active" : "table-sort"}
                  onClick={() => handleSort("likes_count")}
                >
                  Likes {getSortArrow(sortKey === "likes_count", sortDirection)}
                </button>
              </th>
              <th className="table-center">
                <button
                  type="button"
                  className={sortKey === "views_count" ? "table-sort active" : "table-sort"}
                  onClick={() => handleSort("views_count")}
                >
                  Views {getSortArrow(sortKey === "views_count", sortDirection)}
                </button>
              </th>
              <th>URL</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post, index) => {
                const shouldOpenUp = index >= filteredPosts.length - 2;
                const isActionsOpen = openActionsPostId === post.id;

                return (
                  <tr key={post.id}>
                    <td>
                      <div className="project-table-name">
                        {post.project?.logo_url ? (
                          <img
                            src={post.project.logo_url}
                            alt={`${post.project.name} logo`}
                            className="project-logo project-logo-sm"
                          />
                        ) : (
                          <span className="project-logo-fallback project-logo-sm">
                            {(post.project?.name ?? "U").slice(0, 1).toUpperCase()}
                          </span>
                        )}
                        <span style={post.project?.color ? { color: post.project.color } : undefined}>
                          {post.project?.name ?? "Unknown"}
                        </span>
                      </div>
                    </td>
                    <td className="summary-cell">
                      <Link href={`/posts/${post.id}`} className="summary-link">
                        {getPostSummary(post)}
                      </Link>
                    </td>
                    <td className="table-center">{formatDateOnly(post.posted_at)}</td>
                    <td className="table-center">{formatTimeOnly(post.posted_at)}</td>
                    <td className="table-center">{formatCompactNumber(post.replies_count)}</td>
                    <td className="table-center">{formatCompactNumber(post.reposts_count)}</td>
                    <td className="table-center">{formatCompactNumber(post.likes_count)}</td>
                    <td className="table-center">{formatCompactNumber(post.views_count)}</td>
                    <td>
                      {post.tweet_url ? (
                        <a href={post.tweet_url} target="_blank" rel="noreferrer" className="table-link">
                          Link
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div className="table-actions-menu" data-actions-menu="true">
                        <button
                          type="button"
                          className={isActionsOpen ? "table-actions-trigger is-open" : "table-actions-trigger"}
                          aria-expanded={isActionsOpen}
                          aria-haspopup="menu"
                          onClick={() =>
                            setOpenActionsPostId((current) => (current === post.id ? "" : post.id))
                          }
                        >
                          Actions
                        </button>
                        {isActionsOpen ? (
                          <div
                            className={
                              shouldOpenUp
                                ? "table-actions-dropdown table-actions-dropdown-up"
                                : "table-actions-dropdown"
                            }
                            role="menu"
                          >
                            <Link href={`/posts/${post.id}`} className="table-action-item">
                              Edit Post
                            </Link>
                            <button
                              type="button"
                              className="table-action-item table-action-item-danger"
                              disabled={deletingId === post.id}
                              onClick={() => handleDelete(post)}
                            >
                              {deletingId === post.id ? "Deleting..." : "Delete"}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10}>
                  <div className="empty-state">
                    <h3>No posts match the current filters</h3>
                    <p>Try another search or add a new post.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="modal-backdrop" role="presentation" onClick={closeCaptureModal}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Quick Capture</p>
                <h3 id="capture-modal-title">
                  {captureStep === "capture" ? "Capture post from URL" : "Review post metrics"}
                </h3>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={closeCaptureModal}
                disabled={isCapturingUrl || isSavingQuickCapture || isPending}
              >
                Close
              </button>
            </div>

            {captureStep === "capture" ? (
              <>
                <div className="form-row">
                  <div className="field">
                    <label htmlFor="captureProjectId">Project</label>
                    <select
                      id="captureProjectId"
                      value={captureProjectId}
                      onChange={(event) => setCaptureProjectId(event.target.value)}
                      disabled={projects.length === 0}
                    >
                      <option value="">{projects.length === 0 ? "No projects yet" : "Select project"}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="captureTweetUrl">Tweet URL</label>
                    <input
                      id="captureTweetUrl"
                      type="url"
                      value={captureTweetUrl}
                      onChange={(event) => setCaptureTweetUrl(event.target.value)}
                      placeholder="https://x.com/your-handle/status/..."
                    />
                  </div>
                </div>

                {captureErrorMessage ? <p className="error-text">{captureErrorMessage}</p> : null}

                <div className="action-row grid-two">
                  <button
                    type="button"
                    className="button"
                    onClick={handleUrlCapture}
                    disabled={isCapturingUrl || isPending || !captureProjectId}
                  >
                    {isCapturingUrl ? "Capturing From URL..." : "Capture From URL"}
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={closeCaptureModal}
                    disabled={isCapturingUrl || isPending}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : captureDraft ? (
              <>
                <div className="metric-grid">
                  <div className="field">
                    <label htmlFor="quickProjectId">Project</label>
                    <select
                      id="quickProjectId"
                      value={captureDraft.projectId}
                      onChange={(event) => setCaptureDraft({ ...captureDraft, projectId: event.target.value })}
                    >
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="quickPostedAt">Posted At</label>
                    <input
                      id="quickPostedAt"
                      type="datetime-local"
                      value={toDateTimeInputValue(captureDraft.postedAt)}
                      onChange={(event) =>
                        setCaptureDraft({ ...captureDraft, postedAt: fromDateTimeInputValue(event.target.value) })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="quickReplies">Replies</label>
                    <input
                      id="quickReplies"
                      inputMode="numeric"
                      value={captureDraft.repliesCount}
                      onChange={(event) =>
                        setCaptureDraft({ ...captureDraft, repliesCount: event.target.value.replace(/[^\d]/g, "") })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="quickReposts">Reposts</label>
                    <input
                      id="quickReposts"
                      inputMode="numeric"
                      value={captureDraft.repostsCount}
                      onChange={(event) =>
                        setCaptureDraft({ ...captureDraft, repostsCount: event.target.value.replace(/[^\d]/g, "") })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="quickLikes">Likes</label>
                    <input
                      id="quickLikes"
                      inputMode="numeric"
                      value={captureDraft.likesCount}
                      onChange={(event) =>
                        setCaptureDraft({ ...captureDraft, likesCount: event.target.value.replace(/[^\d]/g, "") })
                      }
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="quickViews">Views</label>
                    <input
                      id="quickViews"
                      inputMode="numeric"
                      value={captureDraft.viewsCount}
                      onChange={(event) =>
                        setCaptureDraft({ ...captureDraft, viewsCount: event.target.value.replace(/[^\d]/g, "") })
                      }
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="quickSummary">Summary</label>
                  <textarea
                    id="quickSummary"
                    className="textarea-compact"
                    value={captureDraft.summary}
                    onChange={(event) => setCaptureDraft({ ...captureDraft, summary: event.target.value })}
                    placeholder="Short summary of the post"
                  />
                </div>

                {captureErrorMessage ? <p className="error-text">{captureErrorMessage}</p> : null}

                <div className="action-row grid-two">
                  <button
                    type="button"
                    className="button"
                    onClick={handleQuickSave}
                    disabled={isSavingQuickCapture || isPending || !captureDraft.projectId}
                  >
                    {isSavingQuickCapture ? "Saving..." : "Save Post"}
                  </button>
                  <button
                    type="button"
                    className="button-ghost"
                    onClick={() => {
                      setCaptureStep("capture");
                      setCaptureErrorMessage("");
                      setCaptureDraft(null);
                    }}
                    disabled={isSavingQuickCapture || isPending}
                  >
                    Back
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
