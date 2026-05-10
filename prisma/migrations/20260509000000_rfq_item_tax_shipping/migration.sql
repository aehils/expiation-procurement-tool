-- Drop deprecated box price columns and add tax + shipping fields.
ALTER TABLE "RfqItem" DROP COLUMN "ogBoxPrice";
ALTER TABLE "RfqItem" DROP COLUMN "boxPrice";
ALTER TABLE "RfqItem" ADD COLUMN "tax" REAL;
ALTER TABLE "RfqItem" ADD COLUMN "taxMode" TEXT;
ALTER TABLE "RfqItem" ADD COLUMN "domesticShippingCost" REAL;
ALTER TABLE "RfqItem" ADD COLUMN "domesticShippingNaira" REAL;
ALTER TABLE "RfqItem" ADD COLUMN "intlShippingCost" REAL;
ALTER TABLE "RfqItem" ADD COLUMN "intlShippingNaira" REAL;
