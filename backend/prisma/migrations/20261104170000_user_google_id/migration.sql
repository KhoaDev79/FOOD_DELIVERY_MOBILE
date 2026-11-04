-- Đăng nhập bằng Google: lưu mã tài khoản Google (cột mới, cho phép null)
ALTER TABLE "users" ADD COLUMN "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");
