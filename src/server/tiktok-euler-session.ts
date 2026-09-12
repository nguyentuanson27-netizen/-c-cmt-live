import {
  buildEulerWebSocketUrl,
  extractTikTokUniqueId,
  parseEulerMessageBundle,
  sanitizeEulerError,
  type TikTokEulerComment,
} from "./tiktok-euler";

export type TikTokEulerSocketEventMap = {
  open: Record<string, never>;
  message: { data: unknown };
  close: { code: number; reason?: string };
  error: { message?: string };
};

export interface TikTokEulerSocket {
  addEventListener<K extends keyof TikTokEulerSocketEventMap>(
    type: K,
    listener: (event: TikTokEulerSocketEventMap[K]) => void,
  ): void;
  close(code?: number, reason?: string): void;
}

export type TikTokEulerSessionEvents = {
  onComment: (creator: string, comment: TikTokEulerComment) => void;
  onStatus: (creator: string, message: string, level: "info" | "error") => void;
};

export type TikTokEulerSessionConfig = {
  creator: string;
  apiKey: string;
};

type TimerHandle = unknown;

type TikTokEulerSessionDependencies = {
  webSocketFactory?: (url: string) => TikTokEulerSocket;
  setTimeoutFn?: (callback: () => void, delay: number) => TimerHandle;
  clearTimeoutFn?: (timer: TimerHandle) => void;
};

type StartResult = { ok: true; creator: string } | { ok: false; error: string };

const MAX_RECONNECT_ATTEMPTS = 5;
const CONNECT_TIMEOUT_MS = 20_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;
const RETRYABLE_CLOSE_CODES = new Set([1011, 4006, 4429, 4500, 4555, 4556, 4557]);

function defaultWebSocketFactory(url: string): TikTokEulerSocket {
  const WebSocketCtor = (globalThis as unknown as {
    WebSocket?: new (url: string) => TikTokEulerSocket;
  }).WebSocket;
  if (!WebSocketCtor) {
    throw new Error("WebSocket is unavailable in this Node.js runtime");
  }
  return new WebSocketCtor(url);
}

export class TikTokEulerSession {
  private readonly webSocketFactory: (url: string) => TikTokEulerSocket;
  private readonly setTimeoutFn: (callback: () => void, delay: number) => TimerHandle;
  private readonly clearTimeoutFn: (timer: TimerHandle) => void;

  private generation = 0;
  private socket: TikTokEulerSocket | null = null;
  private connectTimer: TimerHandle | null = null;
  private reconnectTimer: TimerHandle | null = null;
  private creator: string | null = null;
  private apiKey = "";
  private events: TikTokEulerSessionEvents | null = null;
  private connecting = false;
  private reconnectAttempts = 0;
  private pendingStartResolve: ((result: StartResult) => void) | null = null;

  constructor(dependencies?: TikTokEulerSessionDependencies) {
    this.webSocketFactory = dependencies?.webSocketFactory ?? defaultWebSocketFactory;
    this.setTimeoutFn = dependencies?.setTimeoutFn ?? ((callback, delay) => setTimeout(callback, delay));
    this.clearTimeoutFn = dependencies?.clearTimeoutFn ?? ((timer) => {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
    });
  }

  public get activeCreator(): string | null {
    return this.creator && !this.connecting ? this.creator : null;
  }

  public get connectingCreator(): string | null {
    return this.creator && this.connecting ? this.creator : null;
  }

  public async start(
    config: TikTokEulerSessionConfig,
    events: TikTokEulerSessionEvents,
  ): Promise<StartResult> {
    if (this.creator) {
      return { ok: false, error: "A TikTok LIVE is already active or connecting" };
    }

    const creator = extractTikTokUniqueId(config.creator);
    if (!creator) {
      return { ok: false, error: "Invalid TikTok creator username or LIVE URL" };
    }
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      return { ok: false, error: "EULER_API_KEY is not configured on the server" };
    }

    const generation = ++this.generation;
    this.creator = creator;
    this.apiKey = apiKey;
    this.events = events;
    this.connecting = true;
    this.reconnectAttempts = 0;

    return new Promise<StartResult>((resolve) => {
      this.pendingStartResolve = resolve;
      this.openSocket(generation);
    });
  }

  public stop(): boolean {
    if (!this.creator) {
      return false;
    }

    const socket = this.socket;
    const resolveStart = this.pendingStartResolve;
    ++this.generation;
    this.cancelConnectTimeout();
    this.cancelReconnect();
    this.socket = null;
    this.creator = null;
    this.apiKey = "";
    this.events = null;
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.pendingStartResolve = null;
    resolveStart?.({ ok: false, error: "TikTok connection stopped" });

    try {
      socket?.close(1000, "Stopped");
    } catch {
      // The session state is already invalidated; a close failure is non-fatal.
    }
    return true;
  }

  private openSocket(generation: number): void {
    if (generation !== this.generation || !this.creator || !this.events) {
      return;
    }

    const creator = this.creator;
    let socket: TikTokEulerSocket;
    try {
      socket = this.webSocketFactory(buildEulerWebSocketUrl(creator, this.apiKey));
    } catch (error) {
      this.finishTerminal(
        generation,
        `Euler Stream connection failed: ${sanitizeEulerError(error, this.apiKey)}`,
      );
      return;
    }

    this.socket = socket;
    this.connectTimer = this.setTimeoutFn(() => {
      this.connectTimer = null;
      if (!this.isCurrent(generation, socket)) {
        return;
      }
      this.finishTerminal(generation, `Euler Stream connection timed out after ${CONNECT_TIMEOUT_MS} ms`);
      try {
        socket.close(1000, "Connect timeout");
      } catch {
        // State has already been invalidated by finishTerminal.
      }
    }, CONNECT_TIMEOUT_MS);

    socket.addEventListener("open", () => {
      if (!this.isCurrent(generation, socket)) {
        return;
      }
      this.cancelConnectTimeout();
      this.connecting = false;
      const resolveStart = this.pendingStartResolve;
      this.pendingStartResolve = null;
      resolveStart?.({ ok: true, creator });
      this.events?.onStatus(creator, `Đã kết nối TikTok @${creator}.`, "info");
    });

    socket.addEventListener("message", (event) => {
      if (!this.isCurrent(generation, socket) || typeof event.data !== "string") {
        return;
      }
      for (const comment of parseEulerMessageBundle(event.data)) {
        this.events?.onComment(creator, comment);
      }
    });

    socket.addEventListener("error", (event) => {
      if (!this.isCurrent(generation, socket)) {
        return;
      }
      const message = sanitizeEulerError(event.message || "WebSocket transport error", this.apiKey);
      this.events?.onStatus(creator, `Euler Stream WebSocket error: ${message}`, "error");
    });

    socket.addEventListener("close", (event) => {
      if (!this.isCurrent(generation, socket)) {
        return;
      }
      this.cancelConnectTimeout();
      this.socket = null;
      this.handleClose(generation, event.code, event.reason || "");
    });
  }

  private handleClose(generation: number, code: number, reason: string): void {
    if (generation !== this.generation || !this.creator || !this.events) {
      return;
    }

    const creator = this.creator;
    const safeReason = sanitizeEulerError(reason || `close code ${code}`, this.apiKey);
    if (RETRYABLE_CLOSE_CODES.has(code) && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      const attemptIndex = this.reconnectAttempts;
      const delay = RECONNECT_DELAYS_MS[attemptIndex];
      this.reconnectAttempts += 1;
      this.connecting = true;
      this.events.onStatus(
        creator,
        `Euler Stream disconnected (${code}: ${safeReason}). Reconnect ${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay} ms.`,
        "error",
      );
      this.reconnectTimer = this.setTimeoutFn(() => {
        this.reconnectTimer = null;
        if (generation !== this.generation || !this.creator) {
          return;
        }
        this.openSocket(generation);
      }, delay);
      return;
    }

    this.finishTerminal(
      generation,
      `Euler Stream closed (${code}: ${safeReason})${
        RETRYABLE_CLOSE_CODES.has(code) ? " after maximum reconnect attempts" : ""
      }`,
    );
  }

  private finishTerminal(generation: number, message: string): void {
    if (generation !== this.generation || !this.creator) {
      return;
    }

    const creator = this.creator;
    const resolveStart = this.pendingStartResolve;
    this.cancelConnectTimeout();
    this.cancelReconnect();
    this.socket = null;
    this.creator = null;
    this.apiKey = "";
    this.connecting = false;
    this.reconnectAttempts = 0;
    this.pendingStartResolve = null;
    resolveStart?.({ ok: false, error: message });
    this.events?.onStatus(creator, message, "error");
    this.events = null;
    ++this.generation;
  }

  private isCurrent(generation: number, socket: TikTokEulerSocket): boolean {
    return generation === this.generation && this.socket === socket && Boolean(this.creator);
  }

  private cancelConnectTimeout(): void {
    if (this.connectTimer !== null) {
      this.clearTimeoutFn(this.connectTimer);
      this.connectTimer = null;
    }
  }

  private cancelReconnect(): void {
    if (this.reconnectTimer !== null) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}
