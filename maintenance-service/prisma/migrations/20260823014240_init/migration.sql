-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'CARPENTRY', 'HOUSEKEEPING', 'INTERNET', 'APPLIANCE', 'PEST_CONTROL', 'OTHER');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('OPEN', 'ACCEPTED', 'RESOLVED', 'CLOSED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "MaintenanceEventType" AS ENUM ('REPORTED', 'ACCEPTED', 'RESOLVED', 'REOPENED', 'CLOSED', 'WITHDRAWN', 'REASSIGNED', 'COMMENTED');

-- CreateTable
CREATE TABLE "maintenance_requests" (
    "id" UUID NOT NULL,
    "reference" TEXT NOT NULL,
    "student_id" UUID NOT NULL,
    "reporter_name" TEXT NOT NULL,
    "reporter_roll_number" TEXT,
    "reporter_phone" TEXT,
    "room_no" TEXT NOT NULL,
    "location_detail" TEXT,
    "category" "MaintenanceCategory" NOT NULL,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'OPEN',
    "assignee_id" UUID,
    "assignee_name" TEXT,
    "accepted_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "reopen_count" INTEGER NOT NULL DEFAULT 0,
    "last_student_view_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_comments" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "author_role" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "maintenance_events" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "type" "MaintenanceEventType" NOT NULL,
    "actor_id" UUID,
    "actor_name" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "maintenance_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "maintenance_requests_reference_key" ON "maintenance_requests"("reference");

-- CreateIndex
CREATE INDEX "maintenance_requests_student_id_status_idx" ON "maintenance_requests"("student_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_requests_status_created_at_idx" ON "maintenance_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "maintenance_requests_assignee_id_status_idx" ON "maintenance_requests"("assignee_id", "status");

-- CreateIndex
CREATE INDEX "maintenance_requests_category_status_idx" ON "maintenance_requests"("category", "status");

-- CreateIndex
CREATE INDEX "maintenance_comments_request_id_created_at_idx" ON "maintenance_comments"("request_id", "created_at");

-- CreateIndex
CREATE INDEX "maintenance_events_request_id_created_at_idx" ON "maintenance_events"("request_id", "created_at");

-- AddForeignKey
ALTER TABLE "maintenance_comments" ADD CONSTRAINT "maintenance_comments_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_events" ADD CONSTRAINT "maintenance_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
