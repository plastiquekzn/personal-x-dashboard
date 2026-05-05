import type { ParsedOcrResult } from "@/lib/types";

type OcrParseInput = {
  dateText?: string;
  bodyText?: string;
  metricsStripText?: string;
  repliesText?: string;
  likesText?: string;
  viewsText?: string;
};

export type OcrLayoutItemInput = {
  text: string;
  score?: number;
  poly: Array<{
    x: number;
    y: number;
  }>;
};

type LayoutLine = {
  text: string;
  normalizedText: string;
  score: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
};

const MONTH_DAY_PATTERN =
  /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:,\s*\d{4})?\b/i;

const STOP_LINE_PATTERNS = [/^show more$/i, /^paid partnership$/i];

function normalizeOcrText(rawText: string) {
  return rawText
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeExtractedLine(line: string) {
  return line
    .replace(/[|¦]/g, "I")
    .replace(/^\s*["']?\d+\s+(?=[A-Za-z])/, "")
    .replace(/^that\s+\[\s*strategy\s*\]/i, "that [ strategy ]")
    .replace(/I strategy I/gi, "[ strategy ]")
    .replace(/\btradegoeson loan\b/gi, "trade goes on @liquidtrading")
    .replace(/\btradegoeson\b/gi, "trade goes on")
    .replace(/\bIR IRERPE Eh\b/g, "")
    .replace(/\bPLASTIO\b/g, "PLASTIQ")
    .replace(/\s=\s(?=[A-Z])/g, " -> ")
    .replace(/^[^A-Za-z0-9@("'[\-]+/, "")
    .replace(/^\s*[=mM®]\s+(?=[A-Za-z"])/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyGarbageLine(line: string) {
  const letters = (line.match(/[A-Za-z]/g) ?? []).length;
  const digits = (line.match(/\d/g) ?? []).length;
  const weirdChars = (line.match(/[^A-Za-z0-9\s.,!?'"@:/()[\]&+\-]/g) ?? []).length;
  const hasLongRepeatedTail = /(.)\1{6,}/.test(line.replace(/\s/g, ""));

  if (!line) {
    return true;
  }

  if (STOP_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
    return true;
  }

  if (hasLongRepeatedTail) {
    return true;
  }

  if (letters === 0 && digits === 0) {
    return true;
  }

  if (letters <= 2 && weirdChars >= 2) {
    return true;
  }

  if (weirdChars > letters && letters < 6) {
    return true;
  }

  return false;
}

function extractPostText(bodyText: string) {
  const normalized = normalizeOcrText(bodyText);
  const lines = normalized
    .split("\n")
    .map((line) => normalizeExtractedLine(line))
    .filter((line) => !isLikelyGarbageLine(line));

  const cleaned: string[] = [];

  for (const line of lines) {
    if (STOP_LINE_PATTERNS.some((pattern) => pattern.test(line))) {
      break;
    }

    cleaned.push(line);
  }

  return cleaned.join("\n").trim();
}

function extractPostedAt(dateText: string) {
  const normalized = normalizeOcrText(dateText);
  const match = normalized.match(MONTH_DAY_PATTERN);

  if (!match) {
    return "";
  }

  const now = new Date();
  const candidate = match[0].includes(",") ? match[0] : `${match[0]}, ${now.getFullYear()}`;
  const parsed = new Date(candidate);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  if (parsed.getTime() - now.getTime() > 1000 * 60 * 60 * 24 * 2) {
    parsed.setFullYear(now.getFullYear() - 1);
  }

  return parsed.toISOString();
}

function extractSingleMetric(metricText: string) {
  const normalized = normalizeOcrText(metricText)
    .replace(/[Oo](?=\d)/g, "0")
    .replace(/[lI](?=\d)/g, "1");

  const match = normalized.match(/\d[\d,.]*[KMB]?/i);

  if (!match) {
    return "";
  }

  const rawValue = match[0].replace(/,/g, "");
  const suffix = rawValue.slice(-1).toUpperCase();
  const multiplierMap: Record<string, number> = {
    K: 1_000,
    M: 1_000_000,
    B: 1_000_000_000
  };

  if (suffix in multiplierMap) {
    const base = Number.parseFloat(rawValue.slice(0, -1));
    return Number.isNaN(base) ? "" : String(Math.round(base * multiplierMap[suffix]));
  }

  const value = Number.parseFloat(rawValue);
  return Number.isNaN(value) ? "" : String(Math.round(value));
}

function extractMetricsFromStrip(metricsStripText: string) {
  const normalized = normalizeOcrText(metricsStripText)
    .replace(/[Oo](?=\d)/g, "0")
    .replace(/[lI](?=\d)/g, "1")
    .replace(/\s+/g, " ");

  const numbers = [...normalized.matchAll(/\d[\d,.]*[KMB]?/gi)].map((match) => extractSingleMetric(match[0])).filter(Boolean);

  if (numbers.length >= 4) {
    const lastFour = numbers.slice(-4);

    return {
      repliesCount: lastFour[0],
      likesCount: lastFour[2],
      viewsCount: lastFour[3]
    };
  }

  if (numbers.length === 3) {
    return {
      repliesCount: numbers[0],
      likesCount: numbers[1],
      viewsCount: numbers[2]
    };
  }

  return {
    repliesCount: "",
    likesCount: "",
    viewsCount: ""
  };
}

function normalizeMetricValue(metricValue: string) {
  if (metricValue.length === 4 && metricValue.startsWith("1")) {
    return metricValue.slice(1);
  }

  return metricValue;
}

function getLayoutBounds(poly: OcrLayoutItemInput["poly"]) {
  const xs = poly.map((point) => point.x);
  const ys = poly.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    maxX,
    minY,
    maxY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width: maxX - minX,
    height: maxY - minY
  };
}

function normalizeLayoutLines(items: OcrLayoutItemInput[]) {
  return items
    .map((item) => {
      const normalizedText = normalizeExtractedLine(item.text);

      if (!normalizedText) {
        return null;
      }

      return {
        text: item.text,
        normalizedText,
        score: item.score ?? 0,
        ...getLayoutBounds(item.poly)
      } satisfies LayoutLine;
    })
    .filter((line): line is LayoutLine => Boolean(line))
    .sort((left, right) => {
      if (Math.abs(left.centerY - right.centerY) > Math.max(left.height, right.height) * 0.5) {
        return left.centerY - right.centerY;
      }

      return left.minX - right.minX;
    });
}

function groupLayoutRows(lines: LayoutLine[]) {
  const rows: LayoutLine[][] = [];

  for (const line of lines) {
    const currentRow = rows.at(-1);

    if (!currentRow) {
      rows.push([line]);
      continue;
    }

    const rowCenterY =
      currentRow.reduce((sum, current) => sum + current.centerY, 0) / currentRow.length;
    const rowHeight =
      currentRow.reduce((sum, current) => sum + current.height, 0) / currentRow.length;

    if (Math.abs(line.centerY - rowCenterY) <= Math.max(rowHeight, line.height) * 0.75) {
      currentRow.push(line);
      currentRow.sort((left, right) => left.minX - right.minX);
      continue;
    }

    rows.push([line]);
  }

  return rows;
}

function isQuotedTweetHeader(text: string) {
  return /@\w+/i.test(text) && MONTH_DAY_PATTERN.test(text);
}

function extractPostedAtFromLayout(lines: LayoutLine[]) {
  const headerText = lines
    .filter((line) => line.centerY < Math.min(220, (lines[0]?.maxY ?? 0) + 120))
    .map((line) => line.normalizedText)
    .join(" ");

  const fromHeader = extractPostedAt(headerText);

  if (fromHeader) {
    return fromHeader;
  }

  const directMatch = lines.find((line) => MONTH_DAY_PATTERN.test(line.normalizedText));
  return directMatch ? extractPostedAt(directMatch.normalizedText) : "";
}

function extractPostTextFromLayout(lines: LayoutLine[], imageWidth: number, imageHeight: number) {
  const rows = groupLayoutRows(lines);
  const dateLine = lines.find((line) => MONTH_DAY_PATTERN.test(line.normalizedText));
  const headerBottom = dateLine ? dateLine.maxY + dateLine.height * 0.6 : imageHeight * 0.08;
  const mediaRowTop =
    rows.find((row) => {
      const rowMinY = Math.min(...row.map((line) => line.minY));
      const rowMinX = Math.min(...row.map((line) => line.minX));
      const rowMaxX = Math.max(...row.map((line) => line.maxX));

      return (
        rowMinY > headerBottom + imageHeight * 0.04 &&
        row.length >= 2 &&
        rowMaxX - rowMinX > imageWidth * 0.42 &&
        row.some((line) => line.centerX > imageWidth * 0.55)
      );
    })?.[0].minY ?? Number.POSITIVE_INFINITY;

  const bodyRows: string[] = [];

  for (const row of rows) {
    const rowMinY = Math.min(...row.map((line) => line.minY));
    const rowMaxY = Math.max(...row.map((line) => line.maxY));
    const rowText = row.map((line) => line.normalizedText).join(" ").trim();

    if (!rowText || rowMaxY <= headerBottom) {
      continue;
    }

    if (rowMinY >= mediaRowTop || rowMinY >= imageHeight * 0.86) {
      break;
    }

    if (STOP_LINE_PATTERNS.some((pattern) => pattern.test(rowText))) {
      break;
    }

    if (isQuotedTweetHeader(rowText)) {
      break;
    }

    if (row.every((line) => isLikelyGarbageLine(line.normalizedText))) {
      continue;
    }

    bodyRows.push(rowText);
  }

  return extractPostText(bodyRows.join("\n"));
}

function extractMetricsFromLayoutItems(items: OcrLayoutItemInput[]) {
  const layoutLines = normalizeLayoutLines(items);
  const metricCandidates = layoutLines
    .flatMap((line) => {
      const matches = [...line.normalizedText.matchAll(/\d[\d,.]*[KMB]?/gi)];

      return matches.map((match, index) => ({
        value: extractSingleMetric(match[0]),
        centerX: line.centerX + index * 0.01
      }));
    })
    .filter((candidate) => candidate.value)
    .sort((left, right) => left.centerX - right.centerX);

  if (metricCandidates.length >= 4) {
    const lastFour = metricCandidates.slice(-4);

    return {
      repliesCount: lastFour[0].value,
      likesCount: lastFour[2].value,
      viewsCount: normalizeMetricValue(lastFour[3].value)
    };
  }

  if (metricCandidates.length >= 3) {
    const lastThree = metricCandidates.slice(-3);

    return {
      repliesCount: lastThree[0].value,
      likesCount: lastThree[1].value,
      viewsCount: normalizeMetricValue(lastThree[2].value)
    };
  }

  return {
    repliesCount: "",
    likesCount: "",
    viewsCount: ""
  };
}

function calculateConfidence(result: {
  postText: string;
  postedAt: string;
  repliesCount: string;
  likesCount: string;
  viewsCount: string;
}) {
  const metricCount =
    Number(Boolean(result.repliesCount)) + Number(Boolean(result.likesCount)) + Number(Boolean(result.viewsCount));

  if (result.postText && result.postedAt && metricCount >= 2) {
    return "high" as const;
  }

  if (result.postText && (result.postedAt || metricCount > 0)) {
    return "medium" as const;
  }

  return "low" as const;
}

export function parseTweetScreenshot(input: OcrParseInput): ParsedOcrResult {
  const dateText = normalizeOcrText(input.dateText ?? "");
  const bodyText = normalizeOcrText(input.bodyText ?? "");
  const metricsStripText = normalizeOcrText(input.metricsStripText ?? "");
  const repliesText = normalizeOcrText(input.repliesText ?? "");
  const likesText = normalizeOcrText(input.likesText ?? "");
  const viewsText = normalizeOcrText(input.viewsText ?? "");
  const stripMetrics = extractMetricsFromStrip(metricsStripText);

  const normalizedViews = normalizeMetricValue(stripMetrics.viewsCount || extractSingleMetric(viewsText));

  const result = {
    summary: "",
    postText: extractPostText(bodyText),
    postedAt: extractPostedAt(dateText),
    repliesCount: stripMetrics.repliesCount || extractSingleMetric(repliesText),
    repostsCount: "",
    likesCount: stripMetrics.likesCount || extractSingleMetric(likesText),
    viewsCount: normalizedViews,
    ocrRawText: [
      "--- date ---",
      dateText,
      "--- body ---",
      bodyText,
      "--- metrics strip ---",
      metricsStripText,
      "--- replies ---",
      repliesText,
      "--- likes ---",
      likesText,
      "--- views ---",
      viewsText
    ]
      .filter(Boolean)
      .join("\n"),
    ocrConfidence: "low" as const
  };

  return {
    ...result,
    ocrConfidence: calculateConfidence(result)
  };
}

export function parseTweetScreenshotFromLayout(input: {
  imageWidth: number;
  imageHeight: number;
  items: OcrLayoutItemInput[];
  metricsItems?: OcrLayoutItemInput[];
}): ParsedOcrResult {
  const layoutLines = normalizeLayoutLines(input.items);
  const layoutMetrics = extractMetricsFromLayoutItems(input.metricsItems ?? input.items);
  const result = {
    summary: "",
    postText: extractPostTextFromLayout(layoutLines, input.imageWidth, input.imageHeight),
    postedAt: extractPostedAtFromLayout(layoutLines),
    repliesCount: layoutMetrics.repliesCount,
    repostsCount: "",
    likesCount: layoutMetrics.likesCount,
    viewsCount: layoutMetrics.viewsCount,
    ocrRawText: [
      "--- layout items ---",
      layoutLines.map((line) => line.normalizedText).join("\n"),
      "--- layout metrics ---",
      (input.metricsItems ?? [])
        .map((item) => normalizeExtractedLine(item.text))
        .filter(Boolean)
        .join("\n")
    ]
      .filter(Boolean)
      .join("\n"),
    ocrConfidence: "low" as const
  };

  return {
    ...result,
    ocrConfidence: calculateConfidence(result)
  };
}

export function mergeParsedOcrResults(
  primary: ParsedOcrResult,
  fallback: ParsedOcrResult
): ParsedOcrResult {
  const result = {
    summary: primary.summary || fallback.summary,
    postText: primary.postText || fallback.postText,
    postedAt: primary.postedAt || fallback.postedAt,
    repliesCount: primary.repliesCount || fallback.repliesCount,
    repostsCount: primary.repostsCount || fallback.repostsCount,
    likesCount: primary.likesCount || fallback.likesCount,
    viewsCount: primary.viewsCount || fallback.viewsCount,
    ocrRawText: [
      "--- smart layout ---",
      primary.ocrRawText,
      "--- fallback ---",
      fallback.ocrRawText
    ]
      .filter(Boolean)
      .join("\n"),
    ocrConfidence: "low" as const
  };

  return {
    ...result,
    ocrConfidence: calculateConfidence(result)
  };
}
