-- Gộp hội thoại trùng (shop, khách, kênh): chuyển tin/đơn sang bản mới nhất rồi xóa bản dư.
UPDATE "messages" AS m
SET "conversationId" = keep.keeper_id
FROM (
  SELECT
    c.id AS dup_id,
    FIRST_VALUE(c.id) OVER (
      PARTITION BY c."shopId", c."customerId", c.channel
      ORDER BY c."lastAt" DESC, c.id
    ) AS keeper_id
  FROM "conversations" c
) AS keep
WHERE m."conversationId" = keep.dup_id
  AND keep.dup_id <> keep.keeper_id;

UPDATE "orders" AS o
SET "conversationId" = keep.keeper_id
FROM (
  SELECT
    c.id AS dup_id,
    FIRST_VALUE(c.id) OVER (
      PARTITION BY c."shopId", c."customerId", c.channel
      ORDER BY c."lastAt" DESC, c.id
    ) AS keeper_id
  FROM "conversations" c
) AS keep
WHERE o."conversationId" = keep.dup_id
  AND keep.dup_id <> keep.keeper_id;

DELETE FROM "conversations" c
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "shopId", "customerId", channel
      ORDER BY "lastAt" DESC, id
    ) AS rn
  FROM "conversations"
) ranked
WHERE c.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "conversations_shopId_customerId_channel_key"
  ON "conversations"("shopId", "customerId", "channel");

-- Identity: rỗng → NULL; giữ bản cũ nhất mỗi (channel, externalId).
UPDATE "customer_identities"
SET "externalId" = NULL
WHERE "externalId" IS NOT NULL AND btrim("externalId") = '';

DELETE FROM "customer_identities" i
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY channel, "externalId"
      ORDER BY id
    ) AS rn
  FROM "customer_identities"
  WHERE "externalId" IS NOT NULL
) ranked
WHERE i.id = ranked.id
  AND ranked.rn > 1;

CREATE UNIQUE INDEX "customer_identities_channel_externalId_key"
  ON "customer_identities"("channel", "externalId");

-- Xóa template checklist không xóa tick lịch sử.
ALTER TABLE "order_checklist_checks" ALTER COLUMN "templateId" DROP NOT NULL;

ALTER TABLE "order_checklist_checks"
  DROP CONSTRAINT "order_checklist_checks_templateId_fkey";

ALTER TABLE "order_checklist_checks"
  ADD CONSTRAINT "order_checklist_checks_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "order_checklist_templates"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "oauth_page_picks" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "pagesJson" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_page_picks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "oauth_page_picks_shopId_idx" ON "oauth_page_picks"("shopId");
CREATE INDEX "oauth_page_picks_expiresAt_idx" ON "oauth_page_picks"("expiresAt");

ALTER TABLE "oauth_page_picks"
  ADD CONSTRAINT "oauth_page_picks_shopId_fkey"
  FOREIGN KEY ("shopId") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "permissions" ("code", "name", "description", "group_name")
VALUES (
  'products.manage',
  'Quản lý sản phẩm',
  'Thêm, sửa, xóa sản phẩm, nhóm và biến thể.',
  'products'
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("roleCode", "permissionCode")
VALUES ('admin', 'products.manage'), ('manager', 'products.manage')
ON CONFLICT DO NOTHING;
