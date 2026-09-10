import { ipcRenderer } from "electron";
import { createCommentTracker } from "../comment-tracker";

const platform = "tiktok" as const;

export type TikTokCommentPayload = {
  username: string;
  text: string;
};

export function extractTikTokComment(el: Element): TikTokCommentPayload | null {
  const messageEl = el.matches?.('[data-e2e="chat-message"]')
    ? el
    : el.querySelector?.('[data-e2e="chat-message"]') || el;

  let username = "";
  const ownerEl = messageEl.querySelector?.('[data-e2e="message-owner-name"]');
  if (ownerEl) {
    username = ownerEl.getAttribute("title")?.trim() || ownerEl.textContent?.trim() || "";
  } else {
    const fallbackOwner = messageEl.querySelector?.('[class*="owner-name"], [class*="nickname"]');
    if (fallbackOwner) {
      username = fallbackOwner.textContent?.trim() || "";
    }
  }

  if (!username) {
    return null;
  }

  let text = "";
  const textEl = messageEl.querySelector?.('.break-words, [class*="break-words"]');
  if (textEl) {
    text = textEl.textContent?.trim() || "";
  } else {
    const candidates = Array.from(messageEl.querySelectorAll?.("div, span") || []);
    for (const cand of candidates) {
      const candText = cand.textContent?.trim() || "";
      if (
        candText &&
        candText !== username &&
        candText !== ":" &&
        !candText.includes(username)
      ) {
        text = candText;
        break;
      }
    }
  }

  text = text.replace(/^[:\s]+/, "").trim();

  const IGNORED_SYSTEM_TEXTS = ["joined", "đã tham gia", "shared", "đã chia sẻ", "followed", "đã follow"];
  if (!text || IGNORED_SYSTEM_TEXTS.includes(text.toLowerCase())) {
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

function currentCommentElements(): Element[] {
  const elements = new Set<Element>();

  document.querySelectorAll('[data-e2e="chat-message"]').forEach((element) => elements.add(element));
  document.querySelectorAll('[data-index]').forEach((item) => {
    const message = item.querySelector('[data-e2e="chat-message"]');
    if (message) {
      elements.add(message);
    }
  });

  return Array.from(elements);
}

function setupCommentObserver(): void {
  const takeNewComment = createCommentTracker(extractTikTokComment, currentCommentElements());

  function processElement(el: Element): void {
    const comment = takeNewComment(el);
    if (!comment) {
      return;
    }

    console.log(`[TIKTOK_CONNECTOR] Detected comment from ${comment.username}: ${comment.text}`);
    ipcRenderer.send("source:comment", {
      platform,
      username: comment.username,
      text: comment.text,
    });
  }

  function scanAll(): void {
    currentCommentElements().forEach(processElement);
  }

  let scanCount = 0;
  const intervalId = setInterval(() => {
    scanAll();
    scanCount++;
    if (scanCount >= 10) {
      clearInterval(intervalId);
    }
  }, 1000);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.matches?.('[data-e2e="chat-message"]')) {
            processElement(el);
          } else if (el.querySelectorAll) {
            el.querySelectorAll('[data-e2e="chat-message"]').forEach(processElement);
          }
        }
      }
    }
  });

  const target = document.body || document.documentElement;
  if (target) {
    observer.observe(target, { childList: true, subtree: true });
  } else {
    window.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  }
}
