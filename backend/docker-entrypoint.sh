#!/bin/sh
# Khởi động container backend: áp dụng migration còn thiếu rồi mới chạy server,
# để deploy lên máy chủ mới (Render, Oracle…) không phải chạy migrate bằng tay.
# Đặt RUN_MIGRATIONS=false nếu muốn tự quản lý migration (vd. chạy nhiều bản backend cùng lúc).
set -e

if [ "${RUN_MIGRATIONS:-true}" != "false" ]; then
  echo "[entrypoint] Đang áp dụng migration (prisma migrate deploy)..."
  node node_modules/prisma/build/index.js migrate deploy
fi

if [ -f "dist/main.js" ]; then
  exec node dist/main.js
else
  exec node dist/src/main.js
fi
