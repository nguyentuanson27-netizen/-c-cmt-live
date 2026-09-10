import { describe, expect, it } from "vitest";
import { getTrustedPlaybackFinishedPayload } from "../src/security/ipc";

describe("playback-finished IPC validation", () => {
  it("accepts only the expected renderer, playback id, and boolean success value", () => {
    expect(getTrustedPlaybackFinishedPayload(7, 7, { id: "c1", success: true }, "c1")).toEqual({
      id: "c1",
      success: true,
    });

    expect(getTrustedPlaybackFinishedPayload(8, 7, { id: "c1", success: true }, "c1")).toBeNull();
    expect(getTrustedPlaybackFinishedPayload(7, 7, { id: "other", success: true }, "c1")).toBeNull();
    expect(getTrustedPlaybackFinishedPayload(7, 7, { id: "c1", success: "true" }, "c1")).toBeNull();
    expect(getTrustedPlaybackFinishedPayload(7, 7, null, "c1")).toBeNull();
  });
});
