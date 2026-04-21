-- CreateTable
CREATE TABLE "CurrencyRate" (
    "code" TEXT NOT NULL PRIMARY KEY,
    "rate" REAL NOT NULL,
    "fetchedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
