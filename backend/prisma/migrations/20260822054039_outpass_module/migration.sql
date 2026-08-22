/*
  Warnings:

  - You are about to drop the column `approved_at` on the `outpasses` table. All the data in the column will be lost.
  - You are about to drop the column `approved_by` on the `outpasses` table. All the data in the column will be lost.
  - You are about to drop the column `qr_payload` on the `outpasses` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[verify_token]` on the table `outpasses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "OutpassStatus" ADD VALUE 'ACTIVE';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SECURITY';

-- AlterTable
ALTER TABLE "outpasses" DROP COLUMN "approved_at",
DROP COLUMN "approved_by",
DROP COLUMN "qr_payload",
ADD COLUMN     "exit_logged_by" UUID,
ADD COLUMN     "exited_at" TIMESTAMP(3),
ADD COLUMN     "return_logged_by" UUID,
ADD COLUMN     "returned_at" TIMESTAMP(3),
ADD COLUMN     "review_note" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "reviewer_id" UUID,
ADD COLUMN     "verify_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "outpasses_verify_token_key" ON "outpasses"("verify_token");

-- CreateIndex
CREATE INDEX "outpasses_status_return_at_idx" ON "outpasses"("status", "return_at");

-- AddForeignKey
ALTER TABLE "outpasses" ADD CONSTRAINT "outpasses_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
