import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { EdgeTtsClient } from "../src/tts/tts-service";
import { TTSService } from "../src/tts/tts-service";

describe("TTS service transport boundary", () => {
  it("passes XML-escaped text to msedge-tts before synthesis", async () => {
    const setMetadata = vi.fn(async () => undefined);
    const toStream = vi.fn((text: string) => {
      const audioStream = new PassThrough();
      queueMicrotask(() => audioStream.end(Buffer.from("audio")));
      return { audioStream } as ReturnType<EdgeTtsClient["toStream"]>;
    });

    const service = new TTSService({
      clientFactory: () => ({ setMetadata, toStream }) as EdgeTtsClient,
    });

    const audio = await service.synthesize(`A&B <tag attr="x">'quoted'</tag>`);

    expect(toStream).toHaveBeenCalledWith(
      "A&amp;B &lt;tag attr=&quot;x&quot;&gt;&apos;quoted&apos;&lt;/tag&gt;",
    );
    expect(audio.toString()).toBe("audio");
  });
});
