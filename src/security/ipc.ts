export type PlaybackFinishedPayload = {
  id: string;
  success: boolean;
};

export function getTrustedPlaybackFinishedPayload(
  senderId: number,
  expectedSenderId: number,
  payload: unknown,
  expectedPlaybackId: string,
): PlaybackFinishedPayload | null {
  if (senderId !== expectedSenderId || !payload || typeof payload !== "object") {
    return null;
  }

  const candidate = payload as Record<string, unknown>;
  if (
    candidate.id !== expectedPlaybackId ||
    typeof candidate.id !== "string" ||
    typeof candidate.success !== "boolean"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    success: candidate.success,
  };
}
