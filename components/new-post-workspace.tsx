"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { dataUrlToFile, prepareImageForOcr } from "@/lib/ocr/client-image";
import { setReviewDraft } from "@/lib/review-draft-store";
import type { ExtractionDraft, ProjectRecord } from "@/lib/types";

type NewPostWorkspaceProps = {
  projects: ProjectRecord[];
};

export function NewPostWorkspace({ projects }: NewPostWorkspaceProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [projectId, setProjectId] = useState("");
  const [tweetUrl, setTweetUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isCapturingUrl, setIsCapturingUrl] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");

  function getFriendlyExtractionError(message?: string) {
    if (!message) {
      return "Extraction failed.";
    }

    if (message.includes("Quota exceeded") || message.includes("RESOURCE_EXHAUSTED")) {
      return "Gemini free tier limit is hit right now. Wait a bit and try again.";
    }

    if (message.includes("currently experiencing high demand") || message.includes("\"code\": 503")) {
      return "Gemini is overloaded right now. Retry in a minute and the app will try fallback models too.";
    }

    return message;
  }

  function pushDraftToReview(draft: ExtractionDraft) {
    setReviewDraft(draft);

    startTransition(() => {
      router.push("/posts/review");
    });
  }

  async function handleExtraction() {
    if (!selectedFile) {
      setErrorMessage("Upload a screenshot before running extraction.");
      return;
    }

    if (!projectId) {
      setErrorMessage("Pick a project before running extraction.");
      return;
    }

    setErrorMessage("");
    setIsExtracting(true);

    try {
      const preparedImage = await prepareImageForOcr(selectedFile);
      const metricsCropFile = dataUrlToFile(
        preparedImage.metricsFocusDataUrl,
        `${selectedFile.name.replace(/\.[^.]+$/, "")}-metrics-focus.png`,
        "image/png"
      );

      const formData = new FormData();
      formData.append("screenshot", selectedFile);
      formData.append("metricsCrop", metricsCropFile);

      const response = await fetch("/api/extract", {
        method: "POST",
        body: formData
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
      };

      if (!response.ok) {
        setErrorMessage(getFriendlyExtractionError(payload.error));
        return;
      }

      const draft: ExtractionDraft = {
        projectId,
        tweetUrl,
        summary: payload.summary ?? "",
        postText: payload.postText ?? "",
        postedAt: payload.postedAt ?? "",
        repliesCount: payload.repliesCount ?? "",
        repostsCount: payload.repostsCount ?? "",
        likesCount: payload.likesCount ?? "",
        viewsCount: payload.viewsCount ?? "",
        ocrRawText: payload.rawText ?? "",
        ocrConfidence: payload.confidence ?? "medium",
        screenshotDataUrl: preparedImage.previewDataUrl,
        screenshotMimeType: selectedFile.type || "image/png",
        screenshotName: selectedFile.name,
        screenshotWidth: preparedImage.width,
        screenshotHeight: preparedImage.height
      };

      pushDraftToReview(draft);
    } catch (error) {
      console.error(error);
      setErrorMessage("AI extraction failed. Check your Gemini API key, then try again.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleUrlCapture() {
    if (!tweetUrl.trim()) {
      setErrorMessage("Paste a tweet URL before running URL capture.");
      return;
    }

    if (!projectId) {
      setErrorMessage("Pick a project before capturing the tweet.");
      return;
    }

    setErrorMessage("");
    setIsCapturingUrl(true);

    try {
      const response = await fetch("/api/extract-from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tweetUrl })
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
        setErrorMessage(getFriendlyExtractionError(payload.error) || "URL capture failed.");
        return;
      }

      const resolvedTweetUrl = payload.tweetUrl ?? tweetUrl;

      const draft: ExtractionDraft = {
        projectId,
        tweetUrl: resolvedTweetUrl,
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
      };

      pushDraftToReview(draft);
    } catch (error) {
      console.error(error);
      setErrorMessage("URL capture failed. Try another tweet URL or retry in a few seconds.");
    } finally {
      setIsCapturingUrl(false);
    }
  }

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Add Post</p>
            <h2>Capture a post</h2>
            <p>Paste a tweet URL or upload a screenshot.</p>
          </div>
        </div>

        <div className="split-layout">
          <div className="upload-zone">
            <div>
              <strong>Drop a screenshot or choose a file</strong>
              <p className="muted">PNG and JPG work best.</p>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  setSelectedFileName(file?.name ?? "");
                }}
              />
              {selectedFileName ? <p className="status-line">Selected: {selectedFileName}</p> : null}
            </div>
          </div>

          <div className="panel-forms">
            <div className="form-row">
              <div className="field">
                <label htmlFor="projectId">Project</label>
                <select
                  id="projectId"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
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
                <label htmlFor="tweetUrl">Tweet URL</label>
                <input
                  id="tweetUrl"
                  type="url"
                  value={tweetUrl}
                  onChange={(event) => setTweetUrl(event.target.value)}
                  placeholder="https://x.com/your-handle/status/..."
                />
              </div>
            </div>

            {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

            <div className="action-row grid-two">
              <button
                type="button"
                className="button"
                onClick={handleUrlCapture}
                disabled={isExtracting || isCapturingUrl || isPending || projects.length === 0 || !projectId}
              >
                {isCapturingUrl ? "Capturing From URL..." : "Capture From URL"}
              </button>
              <button
                type="button"
                className="button-ghost"
                onClick={handleExtraction}
                disabled={isExtracting || isCapturingUrl || isPending || projects.length === 0}
              >
                {isExtracting ? "Running Screenshot Extraction..." : "Extract From Screenshot"}
              </button>
            </div>

            <div className="action-row grid-two">
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setSelectedFile(null);
                  setSelectedFileName("");
                  setTweetUrl("");
                  setProjectId("");
                  setErrorMessage("");
                }}
              >
                Reset Form
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
