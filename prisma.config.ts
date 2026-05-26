import path from "node:path";
import { defineConfig } from "prisma/config";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";

export default defineConfig({
  experimental: { adapter: true },
  schema: path.join("prisma", "schema.prisma"),
  engine: "js",
  adapter: async () =>
    new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN!,
    }),
});
