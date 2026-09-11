import { describe, expect, it } from "vitest";
import {
  FACEBOOK_COMMENT_OBSERVER_OPTIONS,
  createFacebookProcessedArticleState,
  takeNewFacebookComment,
} from "../src/connectors/facebook/preload";
import {
  TIKTOK_COMMENT_OBSERVER_OPTIONS,
  createTikTokProcessedElementState,
  takeNewTikTokComment,
} from "../src/connectors/tiktok/preload";

function mutableFacebookArticle(): {
  element: Element;
  setComment(username: string, text: string): void;
} {
  let username = "";
  let text = "";

  const element = {
    getAttribute(name: string) {
      if (name === "aria-label" && username) {
        return `Comment by ${username} just now`;
      }
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes('dir="auto"') && text) {
        return [{ textContent: text }];
      }
      return [];
    },
  } as unknown as Element;

  return {
    element,
    setComment(nextUsername: string, nextText: string) {
      username = nextUsername;
      text = nextText;
    },
  };
}

function mutableTikTokMessage(username: string, initialText: string): {
  element: Element;
  setText(text: string): void;
} {
  let text = initialText;

  const element = {
    matches(selector: string) {
      return selector.includes("chat-message");
    },
    querySelector(selector: string) {
      if (selector.includes("message-owner-name")) {
        return { textContent: username, getAttribute: () => null };
      }
      if (selector.includes("break-words")) {
        return { textContent: text };
      }
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as Element;

  return {
    element,
    setText(nextText: string) {
      text = nextText;
    },
  };
}

describe("sandboxed preload element tracking", () => {
  it("does not baseline an incomplete Facebook article and emits it once populated", () => {
    const article = mutableFacebookArticle();
    const processed = createFacebookProcessedArticleState([article.element]);

    expect(takeNewFacebookComment(processed, article.element)).toBeNull();

    article.setComment("Alice", "comment arrived after container creation");
    expect(takeNewFacebookComment(processed, article.element)).toEqual({
      username: "Alice",
      text: "comment arrived after container creation",
    });
    expect(takeNewFacebookComment(processed, article.element)).toBeNull();
  });

  it("observes Facebook aria-label changes used by the parser", () => {
    expect(FACEBOOK_COMMENT_OBSERVER_OPTIONS).toMatchObject({
      attributes: true,
      attributeFilter: ["aria-label"],
      subtree: true,
    });
  });

  it("allows a reused TikTok element to emit when its comment content changes", () => {
    const message = mutableTikTokMessage("Bob", "first comment");
    const processed = createTikTokProcessedElementState([message.element]);

    expect(takeNewTikTokComment(processed, message.element)).toBeNull();

    message.setText("second comment");
    expect(takeNewTikTokComment(processed, message.element)).toEqual({
      username: "Bob",
      text: "second comment",
    });
    expect(takeNewTikTokComment(processed, message.element)).toBeNull();
  });

  it("observes TikTok title changes used by the parser", () => {
    expect(TIKTOK_COMMENT_OBSERVER_OPTIONS).toMatchObject({
      attributes: true,
      attributeFilter: ["title"],
      subtree: true,
    });
  });
});
