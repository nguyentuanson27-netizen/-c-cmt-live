import { ipcRenderer } from "electron";
import { createCommentTracker } from "../comment-tracker";

const platform = "facebook" as const;

export type FacebookCommentPayload = {
  username: string;
  text: string;
};

export function extractFacebookComment(article: Element): FacebookCommentPayload | null {
  let username = "";

  const aria = article.getAttribute("aria-label") || "";
  const viMatch = aria.match(/Bình luận (?:dưới tên|của)\s+(.+?)(?:\s+vào khoảng|\s+vừa xong|\s+vài giây|\s+\d|\.|$)/i);
  if (viMatch && viMatch[1]) {
    username = viMatch[1].trim();
  } else {
    const enMatch = aria.match(/Comment (?:from|by)\s+(.+?)(?:\s+about|\s+just now|\s+\d|\.|$)/i);
    if (enMatch && enMatch[1]) {
      username = enMatch[1].trim();
    }
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

  const candidates = Array.from(article.querySelectorAll('div[dir="auto"], span[dir="auto"]'));
  let text = "";
  const IGNORED_ACTIONS = ["Thích", "Phản hồi", "Chia sẻ", "Dịch", "Like", "Reply", "Share", "Translate"];

  for (const el of candidates) {
    const candidateText = el.textContent?.trim() || "";
    if (
      candidateText &&
      candidateText !== username &&
      !IGNORED_ACTIONS.includes(candidateText) &&
      !candidateText.startsWith("Bình luận")
    ) {
      text = candidateText;
      break;
    }
  }

  if (!text) {
    return null;
  }

  return { username, text };
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
  const takeNewComment = createCommentTracker(
    extractFacebookComment,
    document.querySelectorAll('[role="article"]'),
  );

  function processArticle(article: Element): void {
    const comment = takeNewComment(article);
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

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.getAttribute("role") === "article") {
            processArticle(el);
          } else {
            el.querySelectorAll('[role="article"]').forEach(processArticle);
          }
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}
