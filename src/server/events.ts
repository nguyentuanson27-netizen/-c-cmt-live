import type { ServerResponse } from "node:http";

export type SseEvent = { type: string } & Record<string, unknown>;

export class SseHub {
  private readonly clients = new Set<ServerResponse>();

  public get clientCount(): number {
    return this.clients.size;
  }

  public addClient(response: ServerResponse): () => void {
    this.clients.add(response);
    response.write("retry: 2000\n\n");
    return () => {
      this.clients.delete(response);
    };
  }

  public broadcast(event: SseEvent): void {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  public broadcastOne(event: SseEvent): boolean {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of this.clients) {
      try {
        client.write(payload);
        return true;
      } catch {
        this.clients.delete(client);
      }
    }
    return false;
  }
}
