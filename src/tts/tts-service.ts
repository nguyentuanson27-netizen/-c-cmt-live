import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Comment } from "../core/comment";

export type EdgeTtsClient = Pick<MsEdgeTTS, "setMetadata" | "toStream">;

export function formatCommentForTTS(comment: Comment): string {
  if (comment.sourceLabel === "FB-API") {
    return comment.text;
  }
  return `${comment.username}: ${comment.text}`;
}

export function escapeXmlForSsml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export type TTSServiceOptions = {
  voice?: string;
  rate?: string;
  volume?: string;
  pitch?: string;
  clientFactory?: () => EdgeTtsClient;
};

export class TTSService {
  private client: EdgeTtsClient | null = null;
  private voice: string;
  private outputFormat: OUTPUT_FORMAT;
  private initPromise: Promise<void> | null = null;
  private readonly clientFactory: () => EdgeTtsClient;

  constructor(options?: TTSServiceOptions) {
    this.voice = options?.voice ?? "vi-VN-HoaiMyNeural";
    this.outputFormat = OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3;
    this.clientFactory = options?.clientFactory ?? (() => new MsEdgeTTS());
  }

  private async ensureInit(): Promise<void> {
    try {
      if (!this.client) {
        this.client = this.clientFactory();
        this.initPromise = this.client.setMetadata(this.voice, this.outputFormat);
      }
      if (this.initPromise) {
        await this.initPromise;
      }
    } catch (error) {
      this.client = null;
      this.initPromise = null;
      throw error;
    }
  }

  public async setVoice(voice: string): Promise<void> {
    this.voice = voice;
    if (this.client) {
      await this.client.setMetadata(this.voice, this.outputFormat);
    }
  }

  public async synthesize(text: string): Promise<Buffer> {
    await this.ensureInit();
    return new Promise((resolve, reject) => {
      let settled = false;
      const resetClient = (): void => {
        this.client = null;
        this.initPromise = null;
      };

      try {
        const { audioStream } = this.client!.toStream(escapeXmlForSsml(text));
        const chunks: Buffer[] = [];

        const timeout = setTimeout(() => {
          resetClient();
          audioStream.destroy();
          if (!settled) {
            settled = true;
            reject(new Error("TTS synthesis timed out after 10s"));
          }
        }, 10_000);

        audioStream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        audioStream.on("end", () => {
          clearTimeout(timeout);
          if (!settled) {
            settled = true;
            resolve(Buffer.concat(chunks));
          }
        });

        audioStream.on("error", (err: Error) => {
          clearTimeout(timeout);
          resetClient();
          if (!settled) {
            settled = true;
            reject(err);
          }
        });
      } catch (error) {
        resetClient();
        if (!settled) {
          settled = true;
          reject(error);
        }
      }
    });
  }
}