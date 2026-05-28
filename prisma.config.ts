import path from "node:path";
import { defineConfig } from "prisma/config";
import * as adapterModule from "@prisma/adapter-libsql";
import "dotenv/config";

// The adapter package renamed its export across versions (PrismaLibSql →
// PrismaLibSQL) and the CJS/ESM interop sometimes nests it under `default`.
// Resolve defensively so this works regardless of the installed version —
// mirrors the same guard in src/lib/db.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */
const PrismaLibSQL: new (...args: any[]) => any =
  (adapterModule as any).PrismaLibSQL ??
  (adapterModule as any).PrismaLibSql ??
  (adapterModule as any).default?.PrismaLibSQL ??
  (adapterModule as any).default?.PrismaLibSql;
/* eslint-enable @typescript-eslint/no-explicit-any */

export default defineConfig({
  experimental: { adapter: true },
  schema: path.join("prisma", "schema.prisma"),
  engine: "js",
  adapter: async () =>
    new PrismaLibSQL({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    }),
});
