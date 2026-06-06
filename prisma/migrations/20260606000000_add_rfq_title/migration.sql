-- Add an optional human-given title to RFQs. Nullable, so existing rows and
-- the manual entry form (which doesn't yet collect a title) stay valid.
-- SQLite can add a nullable column in place, no table rebuild needed.
ALTER TABLE "Rfq" ADD COLUMN "title" TEXT;
