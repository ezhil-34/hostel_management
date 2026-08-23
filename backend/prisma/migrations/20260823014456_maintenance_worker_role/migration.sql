/*
  Warnings:

  - You are about to drop the `maintenance_requests` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'MAINTENANCE_WORKER';

-- DropForeignKey
ALTER TABLE "maintenance_requests" DROP CONSTRAINT "maintenance_requests_user_id_fkey";

-- DropTable
DROP TABLE "maintenance_requests";

-- DropEnum
DROP TYPE "MaintenanceCategory";

-- DropEnum
DROP TYPE "MaintenanceStatus";
