CREATE TABLE "MemoryChunk" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "chapterNumber" INTEGER,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "tokenEstimate" INTEGER NOT NULL DEFAULT 0,
    "importance" INTEGER NOT NULL DEFAULT 3,
    "embedding" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemoryChunk_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MemoryChunk_novelId_sourceType_idx" ON "MemoryChunk"("novelId", "sourceType");
CREATE INDEX "MemoryChunk_novelId_chapterNumber_idx" ON "MemoryChunk"("novelId", "chapterNumber");

ALTER TABLE "MemoryChunk" ADD CONSTRAINT "MemoryChunk_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
