-- CreateTable
CREATE TABLE "restaurant_opening_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "openTime" VARCHAR(5) NOT NULL,
    "closeTime" VARCHAR(5) NOT NULL,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_opening_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_special_closings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "restaurantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "reason" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "restaurant_special_closings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "restaurant_opening_hours_restaurantId_idx" ON "restaurant_opening_hours"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_opening_hours_restaurantId_dayOfWeek_key" ON "restaurant_opening_hours"("restaurantId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "restaurant_special_closings_restaurantId_date_idx" ON "restaurant_special_closings"("restaurantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_special_closings_restaurantId_date_key" ON "restaurant_special_closings"("restaurantId", "date");

-- AddForeignKey
ALTER TABLE "restaurant_opening_hours" ADD CONSTRAINT "restaurant_opening_hours_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_special_closings" ADD CONSTRAINT "restaurant_special_closings_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

