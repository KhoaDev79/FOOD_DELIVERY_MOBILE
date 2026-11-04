-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "hiddenImages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[];

