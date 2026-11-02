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

RUN npm ci --omit=dev && npm cache clean --force

# Dùng Prisma client đã generate ở stage 1 (CLI prisma là devDependency nên không có ở đây)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
# Ảnh tĩnh (món ăn, quán, avatar) phục vụ qua /public/
COPY public ./public

EXPOSE 3000

CMD ["node", "dist/main.js"]
