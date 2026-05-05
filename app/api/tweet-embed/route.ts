import { NextResponse } from "next/server";

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

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { tweetUrl?: string } | null;
  const tweetUrl = body?.tweetUrl?.trim() ?? "";

  if (!tweetUrl) {
    return NextResponse.json({ error: "Tweet URL is required." }, { status: 400 });
  }

  if (!isSupportedTweetUrl(tweetUrl)) {
    return NextResponse.json({ error: "Paste a full X/Twitter status URL." }, { status: 400 });
  }

  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("url", tweetUrl);
  endpoint.searchParams.set("omit_script", "true");
  endpoint.searchParams.set("hide_thread", "true");
  endpoint.searchParams.set("hide_media", "true");
  endpoint.searchParams.set("dnt", "true");
  endpoint.searchParams.set("theme", "dark");
  endpoint.searchParams.set("align", "center");
  endpoint.searchParams.set("maxwidth", "550");

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as
      | {
          html?: string;
          author_name?: string;
          provider_name?: string;
          cache_age?: string;
          url?: string;
          error?: string;
        }
      | null;

    if (!response.ok || !payload?.html) {
      return NextResponse.json(
        {
          error: payload?.error || "X oEmbed did not return embeddable HTML."
        },
        { status: response.ok ? 502 : response.status }
      );
    }

    return NextResponse.json(
      {
        html: payload.html,
        authorName: payload.author_name ?? "",
        providerName: payload.provider_name ?? "X",
        cacheAge: payload.cache_age ?? "",
        normalizedTweetUrl: payload.url ?? tweetUrl
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load X embed."
      },
      { status: 500 }
    );
  }
}
