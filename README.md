# 🍔 Food Delivery System

Hệ thống ứng dụng Giao đồ ăn hoàn chỉnh (Full-Stack & Mobile), bao gồm Ứng dụng di động (React Native + Expo) và Backend API (NestJS + PostgreSQL + Prisma).

---

## 🏗️ Kiến trúc & Tech Stack

### 1. Mobile Client (`/mobile`)
- **Framework:** React Native (Expo SDK 52, TypeScript)
- **Navigation:** React Navigation (Nested: Native Stack + Bottom Tabs)
- **State Management:** TanStack Query v5 (Server State) + Zustand (Cart, Auth, Filter)
- **Forms:** React Hook Form + Zod validation
- **Maps & Realtime:** React Native Maps, Expo Location, Socket.IO Client
- **Notifications & Payments:** Expo Push Notifications, VNPay WebBrowser sandbox

### 2. Backend Server (`/backend`)
- **Runtime:** Node.js (v20+), NestJS v11 (TypeScript)
- **Database & ORM:** PostgreSQL + Prisma ORM (Migration tự động, transaction an toàn)
- **Auth:** Stateless JWT (Access/Refresh Token Rotation) + Argon2 hashing
- **RBAC:** Phân quyền `CUSTOMER`, `RESTAURANT_OWNER`, `DRIVER`, `ADMIN`
- **Realtime:** Socket.IO Gateway (phòng theo order & user)
- **Location Processing:** Haversine formula tính khoảng cách và phí giao hàng động
- **Payments:** COD + VNPay Sandbox (IPN & Return verification HMAC-SHA512)

---

## 🚀 Hướng dẫn khởi chạy

### Yêu cầu tiên quyết
- Node.js >= 20.x, npm >= 10.x
- Docker & Docker Compose (cho PostgreSQL)

### 1. Khởi động Cơ sở dữ liệu
```bash
docker-compose up -d
```

### 2. Khởi chạy Backend API
```bash
cd backend
npm install
cp .env.example .env
npx prisma generate
npx prisma migrate dev
npm run prisma:seed
npm run start:dev
```
API hoạt động tại: `http://localhost:3000/api/v1`

### 3. Khởi chạy Mobile App
```bash
cd mobile
npm install
cp .env.example .env
npm run start
```
Quét mã QR bằng ứng dụng **Expo Go** trên thiết bị thật hoặc bấm `a` để chạy trên Android Emulator.

