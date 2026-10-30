-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTORBIKE', 'ELECTRIC_MOTORBIKE', 'BICYCLE');

-- CreateEnum
CREATE TYPE "DriverVerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'MOTORBIKE',
    "vehicleBrand" TEXT,
    "vehicleModel" TEXT,
    "vehicleColor" TEXT,
    "licensePlate" TEXT,
    "driverLicenseClass" TEXT,
    "verificationStatus" "DriverVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" UUID,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "lastLatitude" DOUBLE PRECISION,
    "lastLongitude" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankAccountName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "driver_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_licensePlate_key" ON "driver_profiles"("licensePlate");

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

