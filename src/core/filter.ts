export type FilterOptions = {
  skipUrls?: boolean;
  blockedKeywords?: string[];
  maxTextLength?: number;
};

const URL_REGEX = /(?:https?:\/\/|www\.)\S+/i;

export function normalizeComment(
  rawUsername: string,
  rawText: string,
  options?: FilterOptions
): { username: string; text: string } | null {
  if (typeof rawUsername !== "string" || typeof rawText !== "string") {
    return null;
  }

  const username = rawUsername.replace(/\s+/g, " ").trim();
  let text = rawText.replace(/\s+/g, " ").trim();

  if (!username || !text) {
    return null;
  }

  const maxLen = options?.maxTextLength ?? 250;
  if (text.length > maxLen) {
    text = text.slice(0, maxLen);
  }

  if (options?.skipUrls && URL_REGEX.test(text)) {
    return null;
  }

  if (options?.blockedKeywords && options.blockedKeywords.length > 0) {
    const lowerText = text.toLowerCase();
    const hasBlocked = options.blockedKeywords.some((kw) =>
      lowerText.includes(kw.toLowerCase())
    );
    if (hasBlocked) {
      return null;
    }
  }

  return { username, text };
}
