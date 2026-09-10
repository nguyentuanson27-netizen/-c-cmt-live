import { ipcRenderer } from "electron";

const platform = "tiktok" as const;

export type TikTokCommentPayload = {
  username: string;
  text: string;
};

export function extractTikTokComment(el: Element): TikTokCommentPayload | null {
  const messageEl = el.matches?.('[data-e2e="chat-message"]')
    ? el
    : el.querySelector?.('[data-e2e="chat-message"]') || el;

  // 1. Username extraction
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

  // 2. Text extraction
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

  // Clean up leading colons or whitespace
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

function setupCommentObserver(): void {
  const seenComments = new Set<string>();

  function processElement(el: Element): void {
    const comment = extractTikTokComment(el);
    if (!comment) {
      return;
    }

    const key = `${comment.username}:${comment.text}`;
    if (seenComments.has(key)) {
      return;
    }
    seenComments.add(key);

    console.log(`[TIKTOK_CONNECTOR] Detected comment from ${comment.username}: ${comment.text}`);
    ipcRenderer.send("source:comment", {
      platform,
      username: comment.username,
      text: comment.text,
    });
  }

  function scanAll(): void {
    document.querySelectorAll('[data-e2e="chat-message"]').forEach(processElement);
    document.querySelectorAll('[data-index]').forEach((item) => {
      const msg = item.querySelector('[data-e2e="chat-message"]');
      if (msg) {
        processElement(msg);
      }
    });
  }

  // Scan existing comments immediately
  scanAll();

  // Periodic scan to catch initial streaming or virtualized loading
  let scanCount = 0;
  const intervalId = setInterval(() => {
    scanAll();
    scanCount++;
    if (scanCount >= 10) {
      clearInterval(intervalId);
    }
  }, 1000);

  // Observe dynamically added comment elements
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
