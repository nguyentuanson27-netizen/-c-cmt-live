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

  it("recreates the client after initialization fails so a retry can recover", async () => {
    const failedSetMetadata = vi.fn(async () => {
      throw new Error("temporary connection failure");
    });
    const successfulSetMetadata = vi.fn(async () => undefined);
    const successfulToStream = vi.fn(() => {
      const audioStream = new PassThrough();
      queueMicrotask(() => audioStream.end(Buffer.from("recovered")));
      return { audioStream } as ReturnType<EdgeTtsClient["toStream"]>;
    });

    const clientFactory = vi
      .fn<() => EdgeTtsClient>()
      .mockReturnValueOnce({
        setMetadata: failedSetMetadata,
        toStream: vi.fn(),
      } as EdgeTtsClient)
      .mockReturnValueOnce({
        setMetadata: successfulSetMetadata,
        toStream: successfulToStream,
      } as EdgeTtsClient);

    const service = new TTSService({ clientFactory });

    await expect(service.synthesize("hello")).rejects.toThrow("temporary connection failure");
    await expect(service.synthesize("hello")).resolves.toEqual(Buffer.from("recovered"));

    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(successfulSetMetadata).toHaveBeenCalledTimes(1);
    expect(successfulToStream).toHaveBeenCalledTimes(1);
  });
});
