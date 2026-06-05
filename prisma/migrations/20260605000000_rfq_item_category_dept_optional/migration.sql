-- Allow itemCategory and department to be NULL on RfqItem so spreadsheet
-- uploads can land with them blank. SQLite can't ALTER a column's nullability
-- in place, so we rebuild the table.

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_RfqItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rfqId" TEXT NOT NULL,
    "itemCategory" TEXT,
    "department" TEXT,
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
    "nairaUnitPrice" REAL,
    "nairaOverridden" BOOLEAN NOT NULL DEFAULT false,
    "tax" REAL,
    "taxMode" TEXT,
    "domesticShippingCost" REAL,
    "domesticShippingNaira" REAL,
    "intlShippingCost" REAL,
    "intlShippingNaira" REAL,
    "markedComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RfqItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_RfqItem" SELECT
    "id", "rfqId", "itemCategory", "department", "itemName", "itemDescription",
    "requestQuantity", "size", "specification", "brand", "model", "additionalNotes",
    "mProductCode", "unitQuantity", "uom", "manufacturerName", "vendor",
    "vendorLocation", "productLink", "countryOfOrigin", "vendorDeliveryTimeline",
    "originalCurrency", "ogUnitPrice", "nairaUnitPrice", "nairaOverridden",
    "tax", "taxMode", "domesticShippingCost", "domesticShippingNaira",
    "intlShippingCost", "intlShippingNaira", "markedComplete",
    "createdAt", "updatedAt"
FROM "RfqItem";

DROP TABLE "RfqItem";
ALTER TABLE "new_RfqItem" RENAME TO "RfqItem";

PRAGMA foreign_keys=ON;
