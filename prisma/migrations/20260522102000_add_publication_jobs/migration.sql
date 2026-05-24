-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('PENDING', 'RUNNING', 'NEEDS_LOGIN', 'FAILED', 'PUBLISHED', 'CANCELED');

-- CreateTable
CREATE TABLE "PublicationJob" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'fanqie',
    "status" "PublicationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "remoteDraftId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicationJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PublicationJob_platform_status_scheduledAt_idx" ON "PublicationJob"("platform", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PublicationJob_chapterId_platform_key" ON "PublicationJob"("chapterId", "platform");

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicationJob" ADD CONSTRAINT "PublicationJob_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    