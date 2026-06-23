-- AlterTable
ALTER TABLE "product"."ProductImage" ADD COLUMN     "publicId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_publicId_key" ON "product"."ProductImage"("publicId");

