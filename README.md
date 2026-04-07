# Expiation Procurement Tool

Internal RFQ workflow tool for capturing quote requests, sourcing vendors, and
finalizing pricing (with live FX conversion to NGN).

Stack: **Next.js 15** (App Router, TypeScript) · **Prisma** (SQLite locally,
Postgres-ready) · **Tailwind v3** · shadcn-style UI primitives on top of Radix.

## Getting started

```bash
# 1. install dependencies
npm install

# 2. bootstrap your local env file (SQLite path for Prisma)
cp .env.example .env

# 3. apply migrations and generate the Prisma client
npx prisma migrate dev

# 4. run the dev server
npm run dev
```

Open <http://localhost:3000> to use the tool. Entry point for a new RFQ is
`/rfq/new`; the details view lives at `/rfq/{id}/details`.

## Layout

```
prisma/            # schema + migrations
src/
  app/             # App Router pages and the /api/rate route
  components/
    rfq/           # entry-view, details-view, item-detail-form
    ui/            # button, input, select, accordion, etc.
  lib/             # db client, server actions, zod schemas, constants, rates
legacy/
  index.html       # original single-file React-via-CDN prototype (kept for reference)
```

## Environment

The only required variable is `DATABASE_URL`. For local SQLite the value is
`"file:./dev.db"` (resolved relative to `prisma/`). `.env` and `prisma/dev.db`
are intentionally gitignored.

When moving to Postgres later, change `provider` in `prisma/schema.prisma` and
point `DATABASE_URL` at the new server — nothing else in the schema has to
change.

## Scripts

- `npm run dev` — Next.js dev server
- `npm run build` — production build
- `npm run start` — serve a built app
- `npm run lint` — Next.js / ESLint check
- `npx prisma studio` — browse the local database in the browser
