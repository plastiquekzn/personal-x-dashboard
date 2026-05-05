import { createHash } from "node:crypto";

export function createPostFingerprint(postText: string, postedAt: string) {
  const normalizedText = postText.toLowerCase().replace(/\s+/g, " ").trim();
  const datePart = postedAt ? postedAt.slice(0, 10) : "";

  if (!normalizedText && !datePart) {
    return "";
  }

  return createHash("sha256")
    .update(`${normalizedText}::${datePart}`)
    .digest("hex");
}
