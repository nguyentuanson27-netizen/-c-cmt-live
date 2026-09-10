import { describe, expect, it } from "vitest";
import { extractTikTokComment } from "../src/connectors/tiktok/preload";

describe("tiktok comment parser", () => {
  it("extracts username and text from verified live TikTok DOM structure", () => {
    const messageEl = {
      matches(selector: string) {
        return selector.includes("chat-message");
      },
      querySelector(selector: string) {
        if (selector.includes("message-owner-name")) {
          return {
            getAttribute(attr: string) {
              if (attr === "title") return "sà ntin T E L E:phuongnhi74";
              return null;
            },
            textContent: "sà ntin T E L E:phuongnhi74",
          };
        }
        if (selector.includes("break-words")) {
          return {
            textContent: "kím chỗ xả ntinTele pé, dcChon",
          };
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as Element;

    const result = extractTikTokComment(messageEl);
    expect(result).toEqual({
      username: "sà ntin T E L E:phuongnhi74",
      text: "kím chỗ xả ntinTele pé, dcChon",
    });
  });

  it("extracts test marker comments correctly", () => {
    const messageEl = {
      matches(selector: string) {
        return selector.includes("chat-message");
      },
      querySelector(selector: string) {
        if (selector.includes("message-owner-name")) {
          return {
            getAttribute() {
              return null;
            },
            textContent: "user_test_99",
          };
        }
        if (selector.includes("break-words")) {
          return {
            textContent: "TT_TEST_001 con size M khong?",
          };
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as Element;

    const result = extractTikTokComment(messageEl);
    expect(result).toEqual({
      username: "user_test_99",
      text: "TT_TEST_001 con size M khong?",
    });
  });

  it("extracts real live comments observed during session", () => {
    const el1 = {
      matches: (s: string) => s.includes("chat-message"),
      querySelector: (s: string) => {
        if (s.includes("message-owner-name")) return { textContent: "Kimcuong", getAttribute: () => null };
        if (s.includes("break-words")) return { textContent: "vcl sóc hơn Sát thủ" };
        return null;
      },
      querySelectorAll: () => [],
    } as unknown as Element;
    expect(extractTikTokComment(el1)).toEqual({
      username: "Kimcuong",
      text: "vcl sóc hơn Sát thủ",
    });

    const el2 = {
      matches: (s: string) => s.includes("chat-message"),
      querySelector: (s: string) => {
        if (s.includes("message-owner-name")) return { textContent: "Trịnh Nguyên", getAttribute: () => null };
        if (s.includes("break-words")) return { textContent: "thua à kkk" };
        return null;
      },
      querySelectorAll: () => [],
    } as unknown as Element;
    expect(extractTikTokComment(el2)).toEqual({
      username: "Trịnh Nguyên",
      text: "thua à kkk",
    });
  });

  it("extracts comment when querying from wrapper parent element", () => {
    const childMessage = {
      matches(selector: string) {
        return selector.includes("chat-message");
      },
      querySelector(selector: string) {
        if (selector.includes("message-owner-name")) {
          return {
            getAttribute() {
              return "user_abc";
            },
            textContent: "user_abc",
          };
        }
        if (selector.includes("break-words")) {
          return {
            textContent: "TT_TEST_002 gia bao nhieu?",
          };
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    };

    const wrapper = {
      matches() {
        return false;
      },
      querySelector(selector: string) {
        if (selector.includes("chat-message")) {
          return childMessage;
        }
        return null;
      },
    } as unknown as Element;

    const result = extractTikTokComment(wrapper);
    expect(result).toEqual({
      username: "user_abc",
      text: "TT_TEST_002 gia bao nhieu?",
    });
  });

  it("returns null when no username element is found", () => {
    const systemEl = {
      matches() {
        return true;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as Element;

    expect(extractTikTokComment(systemEl)).toBeNull();
  });

  it("returns null when comment text is empty or only colon", () => {
    const emptyEl = {
      matches() {
        return true;
      },
      querySelector(selector: string) {
        if (selector.includes("message-owner-name")) {
          return { textContent: "user_abc", getAttribute: () => null };
        }
        if (selector.includes("break-words")) {
          return { textContent: " :   " };
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as Element;

    expect(extractTikTokComment(emptyEl)).toBeNull();
  });

  it("returns null for system status messages like 'joined'", () => {
    const joinedEl = {
      matches() {
        return true;
      },
      querySelector(selector: string) {
        if (selector.includes("message-owner-name")) {
          return { textContent: "Duy Thức", getAttribute: () => null };
        }
        if (selector.includes("break-words")) {
          return { textContent: "joined" };
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as Element;

    expect(extractTikTokComment(joinedEl)).toBeNull();
  });
});