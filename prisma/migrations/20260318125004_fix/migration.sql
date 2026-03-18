/*
  Warnings:

  - You are about to drop the column `login_end` on the `modules` table. All the data in the column will be lost.
  - You are about to drop the column `login_start` on the `modules` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "groups" ADD COLUMN     "division_id" TEXT;

-- AlterTable
ALTER TABLE "modules" DROP COLUMN "login_end",
DROP COLUMN "login_start",
ADD COLUMN     "access_end" TIMESTAMP(3),
ADD COLUMN     "access_start" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "group_divisions" (
    "id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_divisions_module_id_name_key" ON "group_divisions"("module_id", "name");

-- AddForeignKey
ALTER TABLE "group_divisions" ADD CONSTRAINT "group_divisions_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "group_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
