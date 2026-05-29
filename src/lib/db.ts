import { PrismaClient } from "@prisma/client";
import * as adapterModule from "@prisma/adapter-libsql";

// The package exports PrismaLibSQL; guard against CJS default-wrap too.
/* eslint-disable @typescript-eslint/no-explicit-any */
const PrismaLibSql: new (...args: any[]) => any =
  (adapterModule as any).PrismaLibSQL ??
  (adapterModule as any).PrismaLibSql ??
  (adapterModule as any).default?.PrismaLibSQL ??
  (adapterModule as any).default?.PrismaLibSql;
/* eslint-enable @typescript-eslint/no-explicit-any */

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// libSQL is over HTTP, so a paused Turso DB surfaces as `TypeError: fetch
// failed` (undici gives up while the server is still warming the DB). Detect
// transport-level failures by walking the cause chain — Prisma may wrap, but
// the undici error stays in `.cause`.
function isTransientFetchError(err: unknown): boolean {
  let cur: unknown = err;
  for (let depth = 0; depth < 5 && cur; depth++) {
    if (cur instanceof Error) {
      const msg = cur.message ?? "";
      if (cur.name === "TypeError" && msg === "fetch failed") return true;
      if (
        /ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENETUNREACH|EAI_AGAIN|UND_ERR|HeadersTimeoutError|BodyTimeoutError|SocketError/i.test(
          msg,
        )
      ) {
        return true;
      }
    }
    cur = (cur as { cause?: unknown })?.cause;
  }
  return false;
}

// Retry on transient fetch failures only. The first attempt wakes a sleeping
// Turso instance; backoff gives it time to come up before the next attempt.
export async function withDbRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  const backoffMs = [500, 1500];
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientFetchError(err) || i === attempts - 1) throw err;
      console.warn(
        `[db] transient fetch failure, retrying (attempt ${i + 2}/${attempts})`,
      );
      await new Promise((r) => setTimeout(r, backoffMs[i] ?? 1500));
    }
  }
  throw lastErr;
}
