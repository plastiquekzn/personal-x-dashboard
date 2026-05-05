import { createRequire } from "node:module";

const bundledPlaywrightEntry =
  "C:/Users/Rafael/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.js";

type CapturedTweet = {
  screenshotBuffer: Buffer;
  width: number;
  height: number;
};

type PlaywrightModule = {
  chromium: {
    launch: (options: { headless: boolean }) => Promise<{
      newPage: (options: {
        viewport: { width: number; height: number };
        colorScheme: "dark" | "light";
      }) => Promise<{
        goto: (url: string, options: { waitUntil: "domcontentloaded"; timeout: number }) => Promise<unknown>;
        waitForTimeout: (ms: number) => Promise<void>;
        locator: (selector: string) => {
          first: () => {
            waitFor: (options: { state: "visible"; timeout: number }) => Promise<void>;
            getByText: (text: string) => {
              count: () => Promise<number>;
              first: () => {
                click: (options: { timeout: number }) => Promise<void>;
              };
            };
            boundingBox: () => Promise<{ width: number; height: number } | null>;
            screenshot: (options: { type: "png"; animations: "disabled" }) => Promise<Buffer>;
          };
        };
        close: () => Promise<void>;
      }>;
      close: () => Promise<void>;
    }>;
  };
};

function getPlaywright() {
  const requireFromBundled = createRequire(bundledPlaywrightEntry);
  return requireFromBundled("playwright") as PlaywrightModule;
}

export async function captureTweetFromUrl(tweetUrl: string): Promise<CapturedTweet> {
  const { chromium } = getPlaywright();
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    viewport: { width: 1440, height: 2200 },
    colorScheme: "dark"
  });

  try {
    await page.goto(tweetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000
    });

    await page.waitForTimeout(2500);

    const article = page.locator('article[data-testid="tweet"]').first();
    await article.waitFor({ state: "visible", timeout: 20000 });

    const showMore = article.getByText("Show more");
    if (await showMore.count()) {
      try {
        await showMore.first().click({ timeout: 2000 });
        await page.waitForTimeout(600);
      } catch {
        // Ignore if the text is already expanded or not clickable.
      }
    }

    const box = await article.boundingBox();

    if (!box) {
      throw new Error("Could not measure the tweet block on the page.");
    }

    const screenshotBuffer = await article.screenshot({
      type: "png",
      animations: "disabled"
    });

    return {
      screenshotBuffer,
      width: Math.round(box.width),
      height: Math.round(box.height)
    };
  } finally {
    await page.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
  }
}
