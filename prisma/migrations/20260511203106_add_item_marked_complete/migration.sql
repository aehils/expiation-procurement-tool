-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RfqItem" (
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
INSERT INTO "new_RfqItem" ("additionalNotes", "brand", "countryOfOrigin", "createdAt", "department", "domesticShippingCost", "domesticShippingNaira", "id", "intlShippingCost", "intlShippingNaira", "itemCategory", "itemDescription", "itemName", "mProductCode", "manufacturerName", "model", "nairaOverridden", "nairaUnitPrice", "ogUnitPrice", "originalCurrency", "productLink", "requestQuantity", "rfqId", "size", "specification", "tax", "taxMode", "unitQuantity", "uom", "updatedAt", "vendor", "vendorDeliveryTimeline", "vendorLocation") SELECT "additionalNotes", "brand", "countryOfOrigin", "createdAt", "department", "domesticShippingCost", "domesticShippingNaira", "id", "intlShippingCost", "intlShippingNaira", "itemCategory", "itemDescription", "itemName", "mProductCode", "manufacturerName", "model", "nairaOverridden", "nairaUnitPrice", "ogUnitPrice", "originalCurrency", "productLink", "requestQuantity", "rfqId", "size", "specification", "tax", "taxMode", "unitQuantity", "uom", "updatedAt", "vendor", "vendorDeliveryTimeline", "vendorLocation" FROM "RfqItem";
DROP TABLE "RfqItem";
ALTER TABLE "new_RfqItem" RENAME TO "RfqItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
