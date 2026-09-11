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

  it("recreates the client after stream synthesis fails so subsequent synthesis can recover", async () => {
    const setMetadata1 = vi.fn(async () => undefined);
    const setMetadata2 = vi.fn(async () => undefined);
    const brokenToStream = vi.fn(() => {
      const audioStream = new PassThrough();
      queueMicrotask(() => audioStream.destroy(new Error("Stream closed before the synthesis completed")));
      return { audioStream } as ReturnType<EdgeTtsClient["toStream"]>;
    });
    const workingToStream = vi.fn(() => {
      const audioStream = new PassThrough();
      queueMicrotask(() => audioStream.end(Buffer.from("recovered audio")));
      return { audioStream } as ReturnType<EdgeTtsClient["toStream"]>;
    });

    const clientFactory = vi
      .fn<() => EdgeTtsClient>()
      .mockReturnValueOnce({
        setMetadata: setMetadata1,
        toStream: brokenToStream,
      } as EdgeTtsClient)
      .mockReturnValueOnce({
        setMetadata: setMetadata2,
        toStream: workingToStream,
      } as EdgeTtsClient);

    const service = new TTSService({ clientFactory });

    await expect(service.synthesize("first")).rejects.toThrow("Stream closed before the synthesis completed");
    await expect(service.synthesize("second")).resolves.toEqual(Buffer.from("recovered audio"));

    expect(clientFactory).toHaveBeenCalledTimes(2);
    expect(setMetadata1).toHaveBeenCalledTimes(1);
    expect(setMetadata2).toHaveBeenCalledTimes(1);
    expect(workingToStream).toHaveBeenCalledTimes(1);
  });
});
