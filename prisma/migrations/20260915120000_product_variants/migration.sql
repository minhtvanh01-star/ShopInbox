-- Nhóm sản phẩm + biến thể; migrate dữ liệu Product cũ → 1 variant mặc định

CREATE TYPE "VatPolicy" AS ENUM ('exempt', 'taxable', 'zero');

CREATE TABLE "product_groups" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_groups_shopId_name_key" ON "product_groups"("shopId", "name");
CREATE INDEX "product_groups_shopId_sortOrder_idx" ON "product_groups"("shopId", "sortOrder");

ALTER TABLE "product_groups" ADD CONSTRAINT "product_groups_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cột mới trên products (giữ sku/price/inStock tạm để migrate)
ALTER TABLE "products" ADD COLUMN "groupId" TEXT;
ALTER TABLE "products" ADD COLUMN "code" TEXT;
ALTER TABLE "products" ADD COLUMN "vatPolicy" "VatPolicy" NOT NULL DEFAULT 'exempt';
ALTER TABLE "products" ADD COLUMN "taxRate" INTEGER;
ALTER TABLE "products" ADD COLUMN "selling" BOOLEAN NOT NULL DEFAULT true;

UPDATE "products"
SET
  "code" = COALESCE(NULLIF(TRIM("sku"), ''), 'SP-' || UPPER(SUBSTRING(REPLACE("id", '-', ''), 1, 8))),
  "selling" = "inStock";

-- Tránh trùng code trong cùng shop
WITH ranked AS (
  SELECT
    "id",
    "shopId",
    "code",
    ROW_NUMBER() OVER (PARTITION BY "shopId", "code" ORDER BY "id") AS rn
  FROM "products"
)
UPDATE "products" p
SET "code" = p."code" || '-' || ranked.rn::text
FROM ranked
WHERE p."id" = ranked."id" AND ranked.rn > 1;

ALTER TABLE "products" ALTER COLUMN "code" SET NOT NULL;

CREATE UNIQUE INDEX "products_shopId_code_key" ON "products"("shopId", "code");
CREATE INDEX "products_groupId_idx" ON "products"("groupId");

ALTER TABLE "products" ADD CONSTRAINT "products_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "product_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "product_variants" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
    "selling" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_variants_productId_sortOrder_idx" ON "product_variants"("productId", "sortOrder");

ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mỗi product cũ → 1 biến thể mặc định
INSERT INTO "product_variants" ("id", "productId", "sku", "name", "price", "costPrice", "selling", "sortOrder")
SELECT
  'pv-' || "id",
  "id",
  "sku",
  "name",
  "price",
  0,
  "inStock",
  0
FROM "products";

ALTER TABLE "order_items" ADD COLUMN "variantId" TEXT;

UPDATE "order_items" oi
SET "variantId" = 'pv-' || oi."productId"
WHERE oi."productId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "product_variants" pv WHERE pv."id" = 'pv-' || oi."productId");

CREATE INDEX "order_items_variantId_idx" ON "order_items"("variantId");

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Bỏ cột cũ trên products
ALTER TABLE "products" DROP COLUMN "sku";
ALTER TABLE "products" DROP COLUMN "price";
ALTER TABLE "products" DROP COLUMN "inStock";
