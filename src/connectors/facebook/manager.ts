import { createSourceWindow, type SourceWindow } from "../../windows/source-window";

export type ManagedFacebookSource = {
  id: string;
  url: string;
  source: SourceWindow;
  label: string;
};

export type CreateSourceFn = (url: string) => SourceWindow;

export class FacebookSourceManager {
  private readonly createSource: CreateSourceFn;
  private readonly maxSources: number;
  private readonly sources = new Map<string, ManagedFacebookSource>();

  constructor(
    createSource: CreateSourceFn = (url) => createSourceWindow("facebook", url),
    maxSources = 9,
  ) {
    this.createSource = createSource;
    this.maxSources = maxSources;
  }

  public open(url: string): ManagedFacebookSource {
    if (this.sources.size >= this.maxSources) {
      throw new Error(`Maximum of ${this.maxSources} Facebook sources allowed`);
    }

    const source = this.createSource(url);
    const id = String(source.window?.id ?? this.sources.size + 1);

    const managed: ManagedFacebookSource = {
      id,
      url: source.url,
      source,
      label: `FB ${id}`,
    };

    this.sources.set(id, managed);

    source.window.on?.("closed", () => {
      this.sources.delete(id);
    });

    return managed;
  }

  public list(): ManagedFacebookSource[] {
    return Array.from(this.sources.values());
  }

  public get(id: string): ManagedFacebookSource | null {
    return this.sources.get(id) ?? null;
  }

  public findByWebContentsId(webContentsId: number): ManagedFacebookSource | null {
    for (const managed of this.sources.values()) {
      if (managed.source.window?.webContents?.id === webContentsId) {
        return managed;
      }
    }
    return null;
  }

  public close(id: string): boolean {
    const managed = this.sources.get(id);
    if (!managed) {
      return false;
    }

    this.sources.delete(id);

    if (managed.source.window && !managed.source.window.isDestroyed()) {
      try {
        managed.source.window.close();
      } catch {
        // ignore errors if window is already tearing down
      }
    }

    return true;
  }

  public closeAll(): void {
    const all = Array.from(this.sources.values());
    this.sources.clear();

    for (const managed of all) {
      if (managed.source.window && !managed.source.window.isDestroyed()) {
        try {
          managed.source.window.close();
        } catch {
          // ignore errors during cleanup
        }
      }
    }
  }

  public count(): number {
    return this.sources.size;
  }
}
