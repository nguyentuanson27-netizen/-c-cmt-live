import { ipcRenderer } from "electron";

const platform = "facebook" as const;

export const FACEBOOK_COMMENT_OBSERVER_OPTIONS: MutationObserverInit = {
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ["aria-label"],
  subtree: true,
};

export type FacebookCommentPayload = {
  username: string;
  text: string;
};

export function extractFacebookComment(article: Element): FacebookCommentPayload | null {
  let username = "";

  const aria = article.getAttribute("aria-label") || "";
  const viMatch = aria.match(/Bình luận (?:dưới tên|của)\s+(.+?)(?:\s+vào khoảng|\s+vừa xong|\s+vài giây|\s+\d|\.|$)/i);
  const enMatch = aria.match(/Comment (?:from|by)\s+(.+?)(?:\s+about|\s+just now|\s+\d|\.|$)/i);
  if (viMatch && viMatch[1]) {
    username = viMatch[1].trim();
  } else if (enMatch && enMatch[1]) {
    username = enMatch[1].trim();
  }

  if (!username) {
    const authorLink = article.querySelector('a[role="link"]');
    if (authorLink && authorLink.textContent?.trim()) {
      username = authorLink.textContent.trim();
    }
  }

  if (!username) {
    const anyLink = Array.from(article.querySelectorAll("a")).find(
      (a) => a.textContent?.trim() && !a.querySelector("img"),
    );
    if (anyLink && anyLink.textContent?.trim()) {
      username = anyLink.textContent.trim();
    }
  }

  if (!username) {
    return null;
  }

  const NOTIFICATION_JOIN_SUFFIX_REGEX = /\s+(?:vào|vào xem|tham gia|đã tham gia|vừa tham gia|đã chia sẻ|joined|is watching)$/i;
  if (NOTIFICATION_JOIN_SUFFIX_REGEX.test(username)) {
    return null;
  }

  const candidates = Array.from(article.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
  let text = "";
  const IGNORED_ACTIONS = [
    "Thích",
    "Phản hồi",
    "Chia sẻ",
    "Dịch",
    "Like",
    "Reply",
    "Share",
    "Translate",
    "Người theo dõi hàng đầu",
    "Người đóng góp hàng đầu",
    "Top fan",
    "Người xem thường xuyên",
    "Tác giả",
    "Author",
    "Đang theo dõi",
    "Follow",
    "Chỉnh sửa",
    "Đã chỉnh sửa",
    "Edited",
  ];
  const NOTIFICATION_TEXT_EXACT_REGEX = /^(?:vào|vào xem|tham gia|đã tham gia|vừa tham gia|đã chia sẻ|joined|is watching)$/i;
  const TIMESTAMP_REGEX = /^(?:vừa xong|vài giây(?: trước)?|just now|a few seconds ago|\d+\s*(?:phút|giây|giờ|ngày|tuần|tháng|năm|p|h|d|w|m|s|min|mins|hr|hrs)(?:\s+trước|\s+ago)?)$/i;

  for (const el of candidates) {
    const candidateText = el.textContent?.trim() || "";
    if (
      candidateText &&
      candidateText !== username &&
      !IGNORED_ACTIONS.includes(candidateText) &&
      !candidateText.startsWith("Bình luận") &&
      !NOTIFICATION_TEXT_EXACT_REGEX.test(candidateText) &&
      !TIMESTAMP_REGEX.test(candidateText)
    ) {
      text = candidateText;
      break;
    }
  }

  if (!text) {
    return null;
  }

  const lowerUser = username.toLowerCase();
  const lowerText = text.toLowerCase();
  if (lowerUser === lowerText) {
    return null;
  }

  return { username, text };
}

function commentSignature(comment: FacebookCommentPayload): string {
  return JSON.stringify([comment.username, comment.text]);
}

export function createFacebookProcessedArticleState(
  existingArticles: Iterable<Element>,
): WeakMap<Element, string> {
  const processedArticles = new WeakMap<Element, string>();

  for (const article of existingArticles) {
    const comment = extractFacebookComment(article);
    if (comment) {
      processedArticles.set(article, commentSignature(comment));
    }
  }

  return processedArticles;
}

export function takeNewFacebookComment(
  processedArticles: WeakMap<Element, string>,
  article: Element,
): FacebookCommentPayload | null {
  const comment = extractFacebookComment(article);
  if (!comment) {
    return null;
  }

  const signature = commentSignature(comment);
  if (processedArticles.get(article) === signature) {
    return null;
  }

  processedArticles.set(article, signature);
  return comment;
}

function init(): void {
  ipcRenderer.send("source:ready", {
    platform,
    url: window.location.href,
    title: document.title,
  });

  setupCommentObserver();
}

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
}

function setupCommentObserver(): void {
  // Keep this state local: sandboxed Electron preloads cannot require local CommonJS modules without bundling.
  const processedArticles = createFacebookProcessedArticleState(
    document.querySelectorAll('[role="article"]'),
  );

  function processArticle(article: Element): void {
    const comment = takeNewFacebookComment(processedArticles, article);
    if (!comment) {
      return;
    }

    console.log(`[FB_CONNECTOR] Detected comment from ${comment.username}: ${comment.text}`);
    ipcRenderer.send("source:comment", {
      platform,
      username: comment.username,
      text: comment.text,
    });
  }

  function processMutationNode(node: Node): void {
    const element = node.nodeType === 1 ? (node as Element) : node.parentElement;
    if (!element) {
      return;
    }

    const article = element.matches('[role="article"]')
      ? element
      : element.closest('[role="article"]');
    if (article) {
      processArticle(article);
    }

    element.querySelectorAll('[role="article"]').forEach(processArticle);
  }

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      processMutationNode(mutation.target);
      Array.from(mutation.addedNodes).forEach(processMutationNode);
    }
  });

  if (document.body) {
    observer.observe(document.body, FACEBOOK_COMMENT_OBSERVER_OPTIONS);
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, FACEBOOK_COMMENT_OBSERVER_OPTIONS);
    });
  }
}
