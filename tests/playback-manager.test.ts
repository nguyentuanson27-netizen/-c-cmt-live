import { describe, expect, it, vi } from "vitest";
import { CommentQueue } from "../src/core/queue";
import { PlaybackManager } from "../src/tts/playback-manager";
import type { TTSService } from "../src/tts/tts-service";
import type { Comment } from "../src/core/comment";

function makeComment(id: string, username: string, text: string): Comment {
  return {
    id,
    platform: "facebook",
    sourceId: "src_1",
    username,
    text,
    receivedAt: Date.now(),
  };
}

describe("PlaybackManager sequential playback and retry policy", () => {
  it("plays comments sequentially and emits events", async () => {
    const queue = new CommentQueue();
    queue.enqueue(makeComment("1", "User A", "Comment A"));
    queue.enqueue(makeComment("2", "User B", "Comment B"));

    const spokenTexts: string[] = [];
    const completedIds: string[] = [];

    const mockTTS = {
      synthesize: vi.fn().mockResolvedValue(Buffer.from("dummy_audio")),
    } as unknown as TTSService;

    const manager = new PlaybackManager(queue, mockTTS, {
      onSpeakStart: (_c, text) => spokenTexts.push(text),
      onSpeakEnd: (c) => completedIds.push(c.id),
      playAudio: vi.fn().mockResolvedValue({ success: true }),
    });

    await manager.processNext();

    expect(spokenTexts).toEqual([
      "User A: Comment A",
      "User B: Comment B",
    ]);
    expect(completedIds).toEqual(["1", "2"]);
    expect(manager.getIsPlaying()).toBe(false);
  });

  it("retries failed synthesis/playback once, then skips without stalling queue", async () => {
    const queue = new CommentQueue();
    queue.enqueue(makeComment("1", "User Fail", "Failing comment"));
    queue.enqueue(makeComment("2", "User Success", "Working comment"));

    let failAttempts = 0;
    const mockTTS = {
      synthesize: vi.fn().mockImplementation((text: string) => {
        if (text.includes("User Fail")) {
          failAttempts++;
          throw new Error("TTS Network Glitch");
        }
        return Promise.resolve(Buffer.from("dummy_audio"));
      }),
    } as unknown as TTSService;

    const completed: string[] = [];
    const manager = new PlaybackManager(queue, mockTTS, {
      onSpeakEnd: (c) => completed.push(c.id),
      playAudio: vi.fn().mockResolvedValue({ success: true }),
    });

    await manager.processNext();

    expect(failAttempts).toBe(2);
    expect(completed).toEqual(["1", "2"]);
    expect(queue.size()).toBe(0);
  });
});
