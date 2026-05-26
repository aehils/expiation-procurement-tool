import { PrismaClient } from "@prisma/client";
import * as adapterModule from "@prisma/adapter-libsql";

// Handle both ESM named export and CJS default-wrapped export
const PrismaLibSql =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (adapterModule as any).PrismaLibSql ?? (adapterModule as any).default?.PrismaLibSql;

// Single Prisma instance across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

const adapter = new PrismaLibSql({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
