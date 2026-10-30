-- Đăng nhập bằng tên đăng nhập: thêm cột username
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Gán username cho tài khoản sẵn có = phần trước @ của email (chỉ giữ a-z, 0-9, . và _).
-- Nếu trùng thì thêm số thứ tự phía sau (vd: "an", "an2").
WITH base AS (
  SELECT id,
         COALESCE(NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g'), ''), 'user') AS b,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(NULLIF(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g'), ''), 'user')
           ORDER BY "createdAt", id
         ) AS rn
  FROM "users"
)
UPDATE "users" u
SET "username" = CASE WHEN base.rn = 1 THEN base.b ELSE base.b || base.rn::text END
FROM base
WHERE base.id = u.id;

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
