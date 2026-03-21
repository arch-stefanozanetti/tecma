/**
 * supertest con `request(app)` apre/chiude server effimeri per richiesta → a volte ECONNRESET
 * con Vitest parallelo. Usare un listen stabile + `stableRequest(origin)`.
 */
import type { Application } from "express";
import type { Server } from "node:http";
import request from "supertest";

export async function listenStable(app: Application): Promise<{ server: Server; origin: string }> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr && typeof addr === "object") {
        resolve({ server, origin: `http://127.0.0.1:${addr.port}` });
      } else {
        reject(new Error("server address not available"));
      }
    });
    server.on("error", reject);
  });
}

export function closeStable(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Client supertest verso `origin` (stesso contratto di `request(app)` ma senza server effimero). */
export function stableRequest(origin: string) {
  return request(origin);
}
