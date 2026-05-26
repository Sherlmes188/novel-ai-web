CREATE TABLE "ChapterReview" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "reviewNo" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "overallScore" INTEGER,
    "summary" TEXT,
    "rawOutput" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChapterReviewIssue" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "evidence" TEXT,
    "explanation" TEXT NOT NULL,
    "suggestion" TEXT,
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterReviewIssue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChapterRevision" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "baseVersionId" TEXT,
    "sourceReviewId" TEXT,
    "revisionNo" INTEGER NOT NULL,
    "instruction" TEXT,
    "content" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChapterRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChapterReview_chapterId_createdAt_idx" ON "ChapterReview"("chapterId", "createdAt");
CREATE INDEX "ChapterRevision_chapterId_createdAt_idx" ON "ChapterRevision"("chapterId", "createdAt");

ALTER TABLE "ChapterReview" ADD CONSTRAINT "ChapterReview_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterReview" ADD CONSTRAINT "ChapterReview_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterReviewIssue" ADD CONSTRAINT "ChapterReviewIssue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "ChapterReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterRevision" ADD CONSTRAINT "ChapterRevision_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterRevision" ADD CONSTRAINT "ChapterRevision_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChapterRevision" ADD CONSTRAINT "ChapterRevision_sourceReviewId_fkey" FOREIGN KEY ("sourceReviewId") REFERENCES "ChapterReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
