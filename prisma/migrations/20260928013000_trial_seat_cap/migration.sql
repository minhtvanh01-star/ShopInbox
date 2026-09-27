-- Trần bản chạy thử: shop đang > 5 hạ về 5. Mặc định cột vẫn 3.
ALTER TABLE "shops" ALTER COLUMN "maxUsersPerShop" SET DEFAULT 3;

UPDATE "shops"
SET "maxUsersPerShop" = 5
WHERE "maxUsersPerShop" > 5;
