import { describe, expect, it } from "vitest";
import { escapeXmlForSsml, formatCommentForTTS } from "../src/tts/tts-service";
import type { Comment } from "../src/core/comment";

describe("TTS text formatting", () => {
  it('formats comment exactly as "Tên khách: comment" without platform/source prefix', () => {
    const comment: Comment = {
      id: "c1",
      platform: "facebook",
      sourceId: "src_fb_1",
      sourceLabel: "Page Bán Quần Áo",
      username: "Nguyễn Văn Nam",
      text: "shop ơi còn áo phông màu trắng không?",
      receivedAt: Date.now(),
    };

    const formatted = formatCommentForTTS(comment);
    expect(formatted).toBe("Nguyễn Văn Nam: shop ơi còn áo phông màu trắng không?");
    expect(formatted).not.toContain("facebook");
    expect(formatted).not.toContain("Page Bán Quần Áo");
  });

  it("reads only comment content for the Facebook Graph web source", () => {
    const comment: Comment = {
      id: "c-graph",
      platform: "facebook",
      sourceId: "facebook-graph:live-1",
      username: "Facebook viewer",
      text: "chốt size M",
      receivedAt: Date.now(),
    };

    expect(formatCommentForTTS(comment)).toBe("chốt size M");
  });

  it("handles TikTok comment without platform prefix", () => {
    const comment: Comment = {
      id: "c2",
      platform: "tiktok",
      sourceId: "src_tt_1",
      username: "Thu Thảo",
      text: "cho em xem đầm hoa nhí",
      receivedAt: Date.now(),
    };

    expect(formatCommentForTTS(comment)).toBe("Thu Thảo: cho em xem đầm hoa nhí");
  });

  it("escapes untrusted comment text before embedding it in SSML", () => {
    expect(escapeXmlForSsml(`A&B <tag attr="x">'quoted'</tag>`)).toBe(
      "A&amp;B &lt;tag attr=&quot;x&quot;&gt;&apos;quoted&apos;&lt;/tag&gt;",
    );
  });
});