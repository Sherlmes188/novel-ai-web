CREATE TABLE "CharacterStateHistory" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "chapterId" TEXT,
    "chapterNumber" INTEGER,
    "location" TEXT,
    "physicalState" TEXT,
    "mentalState" TEXT,
    "powerLevel" TEXT,
    "items" TEXT,
    "relationship" TEXT,
    "goal" TEXT,
    "eventSummary" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterStateHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ForeshadowEvent" (
    "id" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "foreshadowId" TEXT NOT NULL,
    "chapterId" TEXT,
    "chapterNumber" INTEGER,
    "eventType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForeshadowEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorldSettingRevision" (
    "id" TEXT NOT NULL,
    "worldSettingId" TEXT NOT NULL,
    "novelId" TEXT NOT NULL,
    "chapterId" TEXT,
    "chapterNumber" INTEGER,
    "oldContent" TEXT,
    "newContent" TEXT NOT NULL,
    "changeReason" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorldSettingRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CharacterStateHistory_characterId_chapterNumber_idx" ON "CharacterStateHistory"("characterId", "chapterNumber");

ALTER TABLE "CharacterStateHistory" ADD CONSTRAINT "CharacterStateHistory_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterStateHistory" ADD CONSTRAINT "CharacterStateHistory_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForeshadowEvent" ADD CONSTRAINT "ForeshadowEvent_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ForeshadowEvent" ADD CONSTRAINT "ForeshadowEvent_foreshadowId_fkey" FOREIGN KEY ("foreshadowId") REFERENCES "Foreshadow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldSettingRevision" ADD CONSTRAINT "WorldSettingRevision_novelId_fkey" FOREIGN KEY ("novelId") REFERENCES "Novel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorldSettingRevision" ADD CONSTRAINT "WorldSettingRevision_worldSettingId_fkey" FOREIGN KEY ("worldSettingId") REFERENCES "WorldSetting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
