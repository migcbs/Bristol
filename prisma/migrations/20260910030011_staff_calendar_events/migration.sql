-- CreateTable
CREATE TABLE "StaffCalendarEvent" (
    "id" TEXT NOT NULL,
    "area" "StaffPosition" NOT NULL,
    "campusId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffCalendarEvent_area_startsAt_idx" ON "StaffCalendarEvent"("area", "startsAt");

-- AddForeignKey
ALTER TABLE "StaffCalendarEvent" ADD CONSTRAINT "StaffCalendarEvent_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCalendarEvent" ADD CONSTRAINT "StaffCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

