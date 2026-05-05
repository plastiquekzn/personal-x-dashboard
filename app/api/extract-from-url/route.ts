import { NextResponse } from "next/server";
import sharp from "sharp";

import { isGeminiConfigured } from "@/lib/env";
import { extractTweetFromScreenshot } from "@/lib/gemini/tweet-extractor";
import { captureTweetFromUrl } from "@/lib/url-capture";

function isSupportedTweetUrl(value: string) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return (
      (hostname === "x.com" || hostname.endsWith(".x.com") || hostname === "twitter.com" || hostname.endsWith(".twitter.com")) &&
      /\/status\/\d+/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function getScreenshotName(tweetUrl: string) {
  const match = tweetUrl.match(/status\/(\d+)/);
  const suffix = match?.[1] ?? Date.now().toString();
  return `tweet-url-capture-${suffix}.png`;
}

async function createMetricsCrop(buffer: Buffer) {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    return null;
  }

  const width = metadata.width;
  const height = metadata.height;
  const left = Math.max(0, Math.round(width * 0.04));
  const top = Math.max(0, Math.round(height * 0.84));
  const cropWidth = Math.max(1, Math.round(width * 0.92));
  const cropHeight = Math.max(1, Math.round(height * 0.12));

  return image
    .extract({
      left,
      top,
      width: Math.min(cropWidth, width - left),
      height: Math.min(cropHeight, height - top)
    })
    .png()
    .toBuffer();
}

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { tweetUrl?: string } | null;
  const tweetUrl = body?.tweetUrl?.trim() ?? "";

  if (!tweetUrl) {
    return NextResponse.json({ error: "Tweet URL is required." }, { status: 400 });
  }

  if (!isSupportedTweetUrl(tweetUrl)) {
    return NextResponse.json({ error: "Paste a full X/Twitter status URL." }, { status: 400 });
  }

  try {
    const captured = await captureTweetFromUrl(tweetUrl);
    const metricsCropBuffer = await createMetricsCrop(captured.screenshotBuffer);

    const extraction = await extractTweetFromScreenshot({
      fileName: getScreenshotName(tweetUrl),
      mimeType: "image/png",
      imageBase64: captured.screenshotBuffer.toString("base64"),
      metricsCropBase64: metricsCropBuffer ? metricsCropBuffer.toString("base64") : null,
      metricsCropMimeType: metricsCropBuffer ? "image/png" : null
    });

    return NextResponse.json(
      {
        ...extraction,
        tweetUrl,
        screenshotDataUrl: `data:image/png;base64,${captured.screenshotBuffer.toString("base64")}`,
        screenshotMimeType: "image/png",
        screenshotName: getScreenshotName(tweetUrl),
        screenshotWidth: captured.width,
        screenshotHeight: captured.height
      },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "URL capture failed."
      },
      { status: 500 }
    );
  }
}
