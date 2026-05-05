import { NextResponse } from "next/server";

import { isGeminiConfigured } from "@/lib/env";
import { extractTweetFromScreenshot } from "@/lib/gemini/tweet-extractor";

export async function POST(request: Request) {
  if (!isGeminiConfigured()) {
    return NextResponse.json({ error: "Gemini API key is not configured." }, { status: 500 });
  }

  const formData = await request.formData();
  const screenshot = formData.get("screenshot");
  const metricsCrop = formData.get("metricsCrop");

  if (!(screenshot instanceof File)) {
    return NextResponse.json({ error: "Screenshot file is required." }, { status: 400 });
  }

  const bytes = Buffer.from(await screenshot.arrayBuffer());
  const imageBase64 = bytes.toString("base64");
  const metricsCropBase64 =
    metricsCrop instanceof File ? Buffer.from(await metricsCrop.arrayBuffer()).toString("base64") : null;

  try {
    const extraction = await extractTweetFromScreenshot({
      fileName: screenshot.name,
      mimeType: screenshot.type || "image/png",
      imageBase64,
      metricsCropBase64,
      metricsCropMimeType: metricsCrop instanceof File ? metricsCrop.type || "image/png" : null
    });

    return NextResponse.json(extraction, { status: 200 });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Gemini extraction failed."
      },
      { status: 500 }
    );
  }
}
