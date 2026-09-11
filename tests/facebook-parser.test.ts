import { describe, expect, it } from "vitest";
import { extractFacebookComment } from "../src/connectors/facebook/preload";

describe("facebook comment parser", () => {
  it("extracts username and text from Vietnamese aria-label and dir=auto structure", () => {
    const article = {
      getAttribute(name: string) {
        if (name === "aria-label") {
          return "Bình luận dưới tên Nguyễn Phong vào khoảng 1 phút trước";
        }
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("dir=\"auto\"")) {
          return [
            { textContent: "FB_TEST_001 con size M khong?" },
          ];
        }
        return [];
      },
    } as unknown as Element;

    const result = extractFacebookComment(article);
    expect(result).toEqual({
      username: "Nguyễn Phong",
      text: "FB_TEST_001 con size M khong?",
    });
  });

  it("extracts username from author link fallback when aria-label is missing", () => {
    const article = {
      getAttribute() {
        return null;
      },
      querySelector(selector: string) {
        if (selector === "a[role=\"link\"]") {
          return { textContent: "Trần Thị B" };
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("dir=\"auto\"")) {
          return [
            { textContent: "Trần Thị B" },
            { textContent: "FB_TEST_002 gia bao nhieu?" },
          ];
        }
        return [];
      },
    } as unknown as Element;

    const result = extractFacebookComment(article);
    expect(result).toEqual({
      username: "Trần Thị B",
      text: "FB_TEST_002 gia bao nhieu?",
    });
  });

  it("extracts username from English aria-label", () => {
    const article = {
      getAttribute(name: string) {
        if (name === "aria-label") {
          return "Comment by Alice Smith about 3 minutes ago";
        }
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes("dir=\"auto\"")) {
          return [
            { textContent: "FB_TEST_003 mau den con khong?" },
          ];
        }
        return [];
      },
    } as unknown as Element;

    const result = extractFacebookComment(article);
    expect(result).toEqual({
      username: "Alice Smith",
      text: "FB_TEST_003 mau den con khong?",
    });
  });

  it("returns null when no username can be determined", () => {
    const article = {
      getAttribute() {
        return null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    } as unknown as Element;

    expect(extractFacebookComment(article)).toBeNull();
  });

  it("rejects Facebook Live viewer join notification like 'Phùng Kim Anh vào'", () => {
    const article = {
      getAttribute() {
        return null;
      },
      querySelector(selector: string) {
        if (selector === 'a[role="link"]') {
          return { textContent: "Phùng Kim Anh vào" };
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes('dir="auto"')) {
          return [{ textContent: "Phùng Kim Anh" }];
        }
        return [];
      },
      textContent: "Phùng Kim Anh vào",
    } as unknown as Element;

    expect(extractFacebookComment(article)).toBeNull();
  });

  it("rejects join notification when text echoes username", () => {
    const article = {
      getAttribute() {
        return null;
      },
      querySelector(selector: string) {
        if (selector === 'a[role="link"]') {
          return { textContent: "Linh Xe Ôm" };
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes('dir="auto"')) {
          return [{ textContent: "Linh Xe Ôm" }];
        }
        return [];
      },
      textContent: "Linh Xe Ôm vào xem",
    } as unknown as Element;

    expect(extractFacebookComment(article)).toBeNull();
  });

  it("rejects notification when text is a join keyword", () => {
    const article = {
      getAttribute() {
        return null;
      },
      querySelector(selector: string) {
        if (selector === 'a[role="link"]') {
          return { textContent: "Nguyễn Long" };
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes('dir="auto"')) {
          return [{ textContent: "vào xem" }];
        }
        return [];
      },
      textContent: "Nguyễn Long vào xem",
    } as unknown as Element;

    expect(extractFacebookComment(article)).toBeNull();
  });

  it("skips timestamp '1 phút' and captures actual comment text", () => {
    const article = {
      getAttribute() {
        return null;
      },
      querySelector(selector: string) {
        if (selector === 'a[role="link"]') {
          return { textContent: "Vũ Quyên" };
        }
        return null;
      },
      querySelectorAll(selector: string) {
        if (selector.includes('dir="auto"')) {
          return [
            { textContent: "Vũ Quyên" },
            { textContent: "1 phút" },
            { textContent: "áo này còn size M không shop?" },
          ];
        }
        return [];
      },
    } as unknown as Element;

    expect(extractFacebookComment(article)).toEqual({
      username: "Vũ Quyên",
      text: "áo này còn size M không shop?",
    });
  });
});
