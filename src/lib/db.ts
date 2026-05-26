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
