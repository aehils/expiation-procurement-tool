-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfqNumber" TEXT NOT NULL,
    "requester" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RfqItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfqId" TEXT NOT NULL,
    "itemCategory" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "itemDescription" TEXT,
    "requestQuantity" REAL NOT NULL,
    "size" TEXT,
    "specification" TEXT,
    "brand" TEXT,
    "model" TEXT,
    "additionalNotes" TEXT,
    "mProductCode" TEXT,
    "unitQuantity" REAL,
    "uom" TEXT,
    "manufacturerName" TEXT,
    "vendor" TEXT,
    "vendorLocation" TEXT,
    "productLink" TEXT,
    "countryOfOrigin" TEXT,
    "vendorDeliveryTimeline" TEXT,
    "originalCurrency" TEXT,
    "ogUnitPrice" REAL,
    "ogBoxPrice" REAL,
    "nairaUnitPrice" REAL,
    "boxPrice" REAL,
    "nairaOverridden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RfqItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_rfqNumber_key" ON "Rfq"("rfqNumber");
