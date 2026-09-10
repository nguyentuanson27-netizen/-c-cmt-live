import type { Comment } from "../core/comment";
import type { CommentQueue } from "../core/queue";
import { formatCommentForTTS, type TTSService } from "./tts-service";

export type PlaybackEvents = {
  onSpeakStart?: (comment: Comment, text: string) => void;
  onSpeakEnd?: (comment: Comment) => void;
  onQueueUpdate?: (queueSize: number) => void;
  playAudio: (id: string, audioBase64: string) => Promise<{ success: boolean }>;
};

export class PlaybackManager {
  private queue: CommentQueue;
  private tts: TTSService;
  private isPlaying = false;
  private isPaused = false;
  private currentComment: Comment | null = null;
  private retryCount = 0;
  private events: PlaybackEvents;

  constructor(queue: CommentQueue, tts: TTSService, events: PlaybackEvents) {
    this.queue = queue;
    this.tts = tts;
    this.events = events;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (!paused && !this.isPlaying) {
      void this.processNext();
    }
  }

  public async processNext(): Promise<void> {
    if (this.isPlaying || this.isPaused) {
      return;
    }

    const comment = this.queue.dequeue();
    this.events.onQueueUpdate?.(this.queue.size());

    if (!comment) {
      this.currentComment = null;
      return;
    }

    this.isPlaying = true;
    this.currentComment = comment;
    this.retryCount = 0;

    await this.playCurrentComment();
  }

  private async playCurrentComment(): Promise<void> {
    const comment = this.currentComment;
    if (!comment) {
      this.isPlaying = false;
      return;
    }

    const textToSpeak = formatCommentForTTS(comment);
    this.events.onSpeakStart?.(comment, textToSpeak);

    try {
      const audioBuffer = await this.tts.synthesize(textToSpeak);
      const audioBase64 = audioBuffer.toString("base64");
      const result = await this.events.playAudio(comment.id, audioBase64);

      if (!result.success) {
        throw new Error("Playback failed in renderer");
      }

      this.events.onSpeakEnd?.(comment);
      this.isPlaying = false;
      this.currentComment = null;
      this.retryCount = 0;
      void this.processNext();
    } catch {
      if (this.retryCount < 1) {
        this.retryCount++;
        // Retry once
        await this.playCurrentComment();
      } else {
        // Skip after 1 retry
        this.events.onSpeakEnd?.(comment);
        this.isPlaying = false;
        this.currentComment = null;
        this.retryCount = 0;
        void this.processNext();
      }
    }
  }

  public getCurrentComment(): Comment | null {
    return this.currentComment;
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
