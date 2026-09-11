export type PlaybackBroadcast = (event: {
  type: "playback";
  id: string;
  mime: "audio/mpeg";
  audioBase64: string;
}) => void;

type PendingPlayback = {
  id: string;
  timer: NodeJS.Timeout;
  resolve: (result: { success: boolean }) => void;
};

export class BrowserPlaybackBridge {
  private pending: PendingPlayback | null = null;

  constructor(
    private readonly broadcast: PlaybackBroadcast,
    private readonly timeoutMs = 30_000,
  ) {}

  public playAudio(id: string, audioBase64: string): Promise<{ success: boolean }> {
    this.cancelPending();

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.pending?.id === id) {
          this.pending = null;
          resolve({ success: false });
        }
      }, this.timeoutMs);

      this.pending = { id, timer, resolve };
      this.broadcast({
        type: "playback",
        id,
        mime: "audio/mpeg",
        audioBase64,
      });
    });
  }

  public complete(id: string, success: boolean): boolean {
    if (!this.pending || this.pending.id !== id) {
      return false;
    }

    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve({ success });
    return true;
  }

  public cancelPending(): void {
    if (!this.pending) {
      return;
    }

    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    pending.resolve({ success: false });
  }
}
