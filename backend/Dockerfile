# Stage 1: Build
FROM node:20-alpine AS builder
# Prisma cần OpenSSL, image alpine không có sẵn
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

COPY tsconfig*.json nest-cli.json ./
COPY src ./src

RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/

# CLI prisma là devDependency nên `npm ci --omit=dev` không cài: cài riêng ĐÚNG phiên bản trong
# package-lock (kèm đủ gói phụ thuộc) để chạy `migrate deploy` khi container khởi động
RUN npm ci --omit=dev \
  && npm install --no-save --omit=dev "prisma@$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
  && npm cache clean --force

# Dùng Prisma client đã generate ở stage 1
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
# Ảnh tĩnh (món ăn, quán, avatar) phục vụ qua /public/
COPY public ./public

COPY docker-entrypoint.sh ./
# Phòng khi file bị đổi sang CRLF trên Windows
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 3000

CMD ["./docker-entrypoint.sh"]
