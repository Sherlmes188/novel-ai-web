"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { callDeepSeek } from "@/lib/deepseek";
import { clearSessionCookie, requireSession, setSessionCookie } from "@/lib/auth";
import { requireOwnedNovelId } from "@/lib/access";
import { intFromForm, textFromForm, wordCount } from "@/lib/utils";
import { parseNovelIdea } from "@/lib/novel-idea";
import { formatChapterValidationResult, validateGeneratedChapter } from "@/lib/chapter-validation";
import { formatMemoryForPrompt, indexChapterMemory, rebuildNovelMemory, searchNovelMemory } from "@/lib/memory";

async function ensureConfiguredAdminUser() {
  const username = process.env.LOGIN_USERNAME || "admin";
  const passwordHash = process.env.LOGIN_PASSWORD_HASH;
  if (!passwordHash) {
    return;
  }
  await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: { username, passwordHash },
  });
}

export async function loginAction(formData: FormData) {
  const username = textFromForm(formData, "username");
  const password = String(formData.get("password") ?? "");
  await ensureConfiguredAdminUser();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) redirect("/login?error=1");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    redirect("/login?error=1");
  }
  await setSessionCookie({ userId: user.id, username: user.username, loginAt: new Date().toISOString() });
  redirect("/novels");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function createNovelAction(formData: FormData) {
  const session = await requireSession();
  const title = textFromForm(formData, "title");
  const type = textFromForm(formData, "type") || "未分类";
  if (!title) return;
  const globalOutline = textFromForm(formData, "globalOutline");
  const protagonist = textFromForm(formData, "protagonist");
  const mainCharacters = textFromForm(formData, "mainCharacters");
  const worldSetting = textFromForm(formData, "worldSetting");
  const characterCreates = buildInitialCharacterCreates(protagonist, mainCharacters);
  const novel = await prisma.novel.create({
    data: {
      userId: session.userId,
      title,
      type,
      subtype: textFromForm(formData, "subtype") || null,
      summary: textFromForm(formData, "summary") || null,
      sellingPoint: textFromForm(formData, "sellingPoint") || null,
      targetChapters: intFromForm(formData.get("targetChapters")),
      targetWordsPerChapter: intFromForm(formData.get("targetWordsPerChapter")),
      targetTotalWords: intFromForm(formData.get("targetTotalWords")),
      stylePreference: textFromForm(formData, "stylePreference") || null,
      forbiddenRules: textFromForm(formData, "forbiddenRules") || null,
      mainGoal: textFromForm(formData, "mainGoal") || null,
      finalGoal: textFromForm(formData, "finalGoal") || null,
      status: globalOutline ? "OUTLINING" : "IDEA",
      settings: {
        create: [
          globalOutline
            ? { type: "global_outline", title: "总大纲", content: globalOutline }
            : null,
          protagonist
            ? { type: "protagonist", title: "主角设定", content: protagonist }
            : null,
        ].filter((item): item is { type: string; title: string; content: string } => Boolean(item)),
      },
      worldSettings: worldSetting
        ? {
            create: {
              title: "核心世界观",
              category: "world",
              content: worldSetting,
              importance: 5,
            },
          }
        : undefined,
      characters: characterCreates.length ? { create: characterCreates } : undefined,
    },
  });
  redirect(`/novels/${novel.id}`);
}

export async function generateNovelIdeaAction(formData: FormData) {
  await requireSession();
  const description = textFromForm(formData, "description");
  if (!description) return;

  const prompt = buildNovelIdeaPrompt(description);

  const task = await prisma.aiTask.create({
    data: {
      taskType: "generate_novel_idea",
      targetType: "novel",
      status: "RUNNING",
      prompt,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      startedAt: new Date(),
    },
  });

  let redirectPath = "/novels/new?aiError=1";
  try {
    const output = await callDeepSeek(
      [
        { role: "system", content: "你是中文网文项目策划助手。必须输出严格 JSON，字段必须完整，不能省略核心设定。" },
        { role: "user", content: prompt },
      ],
      { responseFormat: "json", temperature: Number(process.env.AI_PLANNING_TEMPERATURE ?? 0.7) },
    );
    parseNovelIdea(output);
    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "SUCCESS",
        outputContent: output,
        finishedAt: new Date(),
      },
    });
    redirectPath = `/novels/new?draftTask=${task.id}`;
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
  }
  redirect(redirectPath);
}

export async function updateNovelAction(formData: FormData) {
  const id = textFromForm(formData, "novelId");
  await requireOwnedNovelId(id);
  await prisma.novel.update({
    where: { id },
    data: {
      title: textFromForm(formData, "title"),
      type: textFromForm(formData, "type") || "未分类",
      subtype: textFromForm(formData, "subtype") || null,
      summary: textFromForm(formData, "summary") || null,
      sellingPoint: textFromForm(formData, "sellingPoint") || null,
      targetChapters: intFromForm(formData.get("targetChapters")),
      targetWordsPerChapter: intFromForm(formData.get("targetWordsPerChapter")),
      targetTotalWords: intFromForm(formData.get("targetTotalWords")),
      stylePreference: textFromForm(formData, "stylePreference") || null,
      forbiddenRules: textFromForm(formData, "forbiddenRules") || null,
      mainGoal: textFromForm(formData, "mainGoal") || null,
      finalGoal: textFromForm(formData, "finalGoal") || null,
    },
  });
  revalidatePath(`/novels/${id}`);
}

export async function deleteNovelAction(formData: FormData) {
  const id = textFromForm(formData, "novelId");
  await requireOwnedNovelId(id);
  await prisma.novel.delete({ where: { id } });
  redirect("/novels");
}

export async function schedulePublicationAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const chapterId = textFromForm(formData, "chapterId");
  await requireOwnedNovelId(novelId);
  const scheduledAtText = textFromForm(formData, "scheduledAt");
  const scheduledAt = new Date(scheduledAtText);
  if (!novelId || !chapterId || Number.isNaN(scheduledAt.getTime())) {
    redirect(`/novels/${novelId}/publications?error=invalid`);
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: chapterId, novelId, contentStatus: "FINALIZED", content: { not: null } },
    select: { id: true },
  });
  if (!chapter) {
    redirect(`/novels/${novelId}/publications?error=chapter`);
  }

  await prisma.publicationJob.upsert({
    where: { chapterId_platform: { chapterId, platform: "fanqie" } },
    update: {
      scheduledAt,
      status: "PENDING",
      lastError: null,
      publishedAt: null,
    },
    create: {
      novelId,
      chapterId,
      platform: "fanqie",
      scheduledAt,
    },
  });
  revalidatePath(`/novels/${novelId}/publications`);
}

export async function cancelPublicationAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const jobId = textFromForm(formData, "jobId");
  if (!novelId || !jobId) return;
  await requireOwnedNovelId(novelId);
  await prisma.publicationJob.updateMany({
    where: {
      id: jobId,
      novelId,
      status: { in: ["PENDING", "FAILED", "NEEDS_LOGIN"] },
    },
    data: { status: "CANCELED" },
  });
  revalidatePath(`/novels/${novelId}/publications`);
}

export async function updateFanqieSettingsAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  if (!novelId) return;
  await requireOwnedNovelId(novelId);
  await prisma.novel.update({
    where: { id: novelId },
    data: {
      fanqieWorkspaceUrl: textFromForm(formData, "fanqieWorkspaceUrl") || null,
      fanqiePublishUrl: textFromForm(formData, "fanqiePublishUrl") || null,
    },
  });
  revalidatePath(`/novels/${novelId}/publications`);
}

export async function saveGlobalOutlineAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const content = textFromForm(formData, "content");
  const existing = await prisma.novelSetting.findFirst({ where: { novelId, type: "global_outline" } });
  if (existing) {
    await prisma.version.create({
      data: {
        novelId,
        targetType: "global_outline",
        targetId: existing.id,
        versionNumber: await nextVersion("global_outline", existing.id),
        title: "总大纲",
        content: existing.content,
        changeSummary: "保存前自动归档",
      },
    });
    await prisma.novelSetting.update({ where: { id: existing.id }, data: { content } });
  } else {
    await prisma.novelSetting.create({
      data: { novelId, type: "global_outline", title: "总大纲", content },
    });
  }
  revalidatePath(`/novels/${novelId}/outlines`);
}

export async function createVolumeAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  await prisma.volume.create({
    data: {
      novelId,
      title: textFromForm(formData, "title") || "新分卷",
      summary: textFromForm(formData, "summary") || null,
      startChapterNumber: intFromForm(formData.get("startChapterNumber")) || 1,
      endChapterNumber: intFromForm(formData.get("endChapterNumber")) || 20,
      mainGoal: textFromForm(formData, "mainGoal") || null,
      mainConflict: textFromForm(formData, "mainConflict") || null,
    },
  });
  revalidatePath(`/novels/${novelId}/outlines`);
}

export async function updateVolumeAction(formData: FormData) {
  const id = textFromForm(formData, "volumeId");
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  await prisma.volume.updateMany({
    where: { id, novelId },
    data: {
      title: textFromForm(formData, "title") || "未命名分卷",
      summary: textFromForm(formData, "summary") || null,
      startChapterNumber: intFromForm(formData.get("startChapterNumber")) || 1,
      endChapterNumber: intFromForm(formData.get("endChapterNumber")) || 20,
      mainGoal: textFromForm(formData, "mainGoal") || null,
      mainConflict: textFromForm(formData, "mainConflict") || null,
      climax: textFromForm(formData, "climax") || null,
    },
  });
  revalidatePath(`/novels/${novelId}/outlines`);
}

export async function generateVolumeOutlinesAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const mode = textFromForm(formData, "mode") || "replace";
  const novel = await prisma.novel.findUniqueOrThrow({
    where: { id: novelId },
    include: {
      settings: true,
      volumes: { orderBy: { startChapterNumber: "asc" } },
      characters: { orderBy: { updatedAt: "desc" }, take: 20 },
      worldSettings: { orderBy: { importance: "desc" }, take: 20 },
      forbiddenTerms: { orderBy: [{ severity: "desc" }, { updatedAt: "desc" }], take: 80 },
    },
  });
  const prompt = buildVolumeOutlinesPrompt(novel, textFromForm(formData, "instruction"));
  const task = await prisma.aiTask.create({
    data: {
      novelId,
      targetType: "volume",
      taskType: "generate_volume_outlines",
      status: "RUNNING",
      prompt,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      startedAt: new Date(),
    },
  });

  try {
    const output = await callDeepSeek(
      [
        { role: "system", content: "你是中文长篇网文分卷规划助手。必须输出严格 JSON。" },
        { role: "user", content: prompt },
      ],
      { responseFormat: "json", temperature: Number(process.env.AI_PLANNING_TEMPERATURE ?? 0.7), maxTokens: 12000 },
    );
    const volumes = parseVolumeOutlines(output);
    validateVolumeCoverage(volumes, novel.targetChapters || 200);
    await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.volume.deleteMany({ where: { novelId } });
      }
      for (const [index, volume] of volumes.entries()) {
        await tx.volume.create({
          data: {
            novelId,
            title: volume.title,
            summary: volume.summary,
            startChapterNumber: volume.startChapterNumber,
            endChapterNumber: volume.endChapterNumber,
            mainGoal: volume.mainGoal,
            mainConflict: volume.mainConflict,
            mainEnemy: volume.mainEnemy || null,
            keyCharacters: volume.keyCharacters || null,
            keySettings: volume.keySettings || null,
            foreshadowsToCreate: volume.foreshadowsToCreate || null,
            foreshadowsToResolve: volume.foreshadowsToResolve || null,
            climax: volume.climax || null,
            status: "PENDING_CONFIRM",
            sortOrder: index,
          },
        });
      }
      await tx.aiTask.update({
        where: { id: task.id },
        data: { status: "SUCCESS", outputContent: output, finishedAt: new Date() },
      });
    });
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error), finishedAt: new Date() },
    });
    redirect(`/novels/${novelId}/ai-tasks`);
  }
  redirect(`/novels/${novelId}/outlines`);
}

export async function createChapterAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const number =
    intFromForm(formData.get("chapterNumber")) ||
    ((await prisma.chapter.count({ where: { novelId } })) + 1);
  const chapter = await prisma.chapter.create({
    data: {
      novelId,
      volumeId: textFromForm(formData, "volumeId") || null,
      chapterNumber: number,
      title: textFromForm(formData, "title") || `第 ${number} 章`,
      outline: textFromForm(formData, "outline") || null,
    },
  });
  redirect(`/novels/${novelId}/chapters/${chapter.id}`);
}

export async function generateChapterOutlinesForVolumeAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const volumeId = textFromForm(formData, "volumeId");
  if (!volumeId) return;
  const novel = await prisma.novel.findUniqueOrThrow({
    where: { id: novelId },
    include: {
      settings: true,
      volumes: { orderBy: { startChapterNumber: "asc" } },
      characters: { orderBy: { updatedAt: "desc" }, take: 20 },
      worldSettings: { orderBy: { importance: "desc" }, take: 20 },
      forbiddenTerms: { orderBy: [{ severity: "desc" }, { updatedAt: "desc" }], take: 80 },
    },
  });
  const volume = novel.volumes.find((item) => item.id === volumeId);
  if (!volume) return;
  const prompt = buildChapterOutlinesPrompt(novel, volume, textFromForm(formData, "instruction"));
  const task = await prisma.aiTask.create({
    data: {
      novelId,
      targetType: "volume",
      targetId: volume.id,
      taskType: "generate_chapter_outlines",
      status: "RUNNING",
      prompt,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      startedAt: new Date(),
    },
  });

  try {
    const output = await callDeepSeek(
      [
        { role: "system", content: "你是中文网文章节细纲规划助手。必须输出严格 JSON。" },
        { role: "user", content: prompt },
      ],
      { responseFormat: "json", temperature: Number(process.env.AI_PLANNING_TEMPERATURE ?? 0.7), maxTokens: 12000 },
    );
    const chapters = parseChapterOutlines(output);
    validateChapterCoverage(chapters, volume.startChapterNumber, volume.endChapterNumber);
    await prisma.$transaction(async (tx) => {
      for (const chapter of chapters) {
        if (chapter.chapterNumber < volume.startChapterNumber || chapter.chapterNumber > volume.endChapterNumber) {
          continue;
        }
        await tx.chapter.upsert({
          where: { novelId_chapterNumber: { novelId, chapterNumber: chapter.chapterNumber } },
          update: {
            volumeId: volume.id,
            title: chapter.title,
            outline: chapter.outline,
            outlineStatus: "PENDING_CONFIRM",
          },
          create: {
            novelId,
            volumeId: volume.id,
            chapterNumber: chapter.chapterNumber,
            title: chapter.title,
            outline: chapter.outline,
            outlineStatus: "PENDING_CONFIRM",
          },
        });
      }
      await tx.aiTask.update({
        where: { id: task.id },
        data: { status: "SUCCESS", outputContent: output, finishedAt: new Date() },
      });
    });
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error), finishedAt: new Date() },
    });
    redirect(`/novels/${novelId}/ai-tasks`);
  }
  redirect(`/novels/${novelId}/chapters`);
}

async function autoGenerateLatestChapters(novelId: string, requestedCount: number, instruction: string) {
  const chapterCount = Math.min(Math.max(requestedCount || 1, 1), 20);
  const latestContentChapter = await prisma.chapter.findFirst({
    where: { novelId, content: { not: null } },
    orderBy: { chapterNumber: "desc" },
    select: { chapterNumber: true },
  });
  const baseNovel = await prisma.novel.findUniqueOrThrow({
    where: { id: novelId },
    include: {
      volumes: { orderBy: { startChapterNumber: "asc" } },
    },
  });
  const startChapterNumber = (latestContentChapter?.chapterNumber || 0) + 1;
  const targetEnd = baseNovel.targetChapters
    ? Math.min(startChapterNumber + chapterCount - 1, baseNovel.targetChapters)
    : startChapterNumber + chapterCount - 1;

  for (let chapterNumber = startChapterNumber; chapterNumber <= targetEnd; chapterNumber += 1) {
    const volume = baseNovel.volumes.find(
      (item) => chapterNumber >= item.startChapterNumber && chapterNumber <= item.endChapterNumber,
    );
    let chapter = await prisma.chapter.upsert({
      where: { novelId_chapterNumber: { novelId, chapterNumber } },
      update: {
        volumeId: volume?.id || undefined,
      },
      create: {
        novelId,
        volumeId: volume?.id || null,
        chapterNumber,
        title: `第 ${chapterNumber} 章`,
        outlineStatus: "NOT_STARTED",
        contentStatus: "NOT_STARTED",
      },
    });

    const novelForOutline = await loadNovelForPrompt(novelId);
    const outlinePrompt =
      buildPrompt(
        "chapter_outline",
        novelForOutline,
        chapter,
        [
          `这是自动续写任务，需要生成第 ${chapterNumber} 章细纲。`,
          "细纲必须承接上一章摘要和角色当前状态，服务于当前分卷目标。",
          instruction,
        ].filter(Boolean).join("\n"),
      ) + await buildChapterLocalContext(novelId, chapterNumber, chapter.volumeId);
    const outline = await runAiTask({
      novelId,
      targetType: "chapter",
      targetId: chapter.id,
      taskType: "auto_chapter_outline",
      prompt: outlinePrompt,
      systemPrompt: "你是中文网文章节细纲规划助手。输出可直接编辑的中文细纲，不要寒暄。",
      temperature: Number(process.env.AI_PLANNING_TEMPERATURE ?? 0.7),
    });
    chapter = await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        outline,
        outlineStatus: "PENDING_CONFIRM",
      },
    });

    const novelForContent = await loadNovelForPrompt(novelId);
    const contentPrompt =
      buildPrompt(
        "chapter_content",
        novelForContent,
        chapter,
        [
          `这是自动续写任务，需要生成第 ${chapterNumber} 章正文。`,
          "必须严格使用刚生成的本章细纲，不要跳章，不要提前写后续章节内容。",
          instruction,
        ].filter(Boolean).join("\n"),
      ) + await buildChapterLocalContext(novelId, chapterNumber, chapter.volumeId);
    const content = await runAiTask({
      novelId,
      targetType: "chapter",
      targetId: chapter.id,
      taskType: "auto_chapter_content",
      prompt: contentPrompt,
      systemPrompt: "你是中文网文创作后台的专业 AI 助手。输出直接可编辑的章节正文，不要寒暄。",
    });
    await prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        content,
        wordCount: wordCount(content),
        contentStatus: "PENDING_REVIEW",
      },
    });
    await summarizeAndReviewChapter(novelForContent, novelId, chapter.id, content);
    await refreshNovelWordCount(novelId);
  }

  revalidatePath(`/novels/${novelId}/chapters`);
}

export async function autoGenerateLatestChaptersAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const requestedCount = intFromForm(formData.get("chapterCount")) || 1;
  const instruction = textFromForm(formData, "instruction");
  await autoGenerateLatestChapters(novelId, requestedCount, instruction);
  redirect(`/novels/${novelId}/chapters`);
}

export async function batchGenerateLatestChaptersAction(formData: FormData) {
  const session = await requireSession();
  const novelIds = formData.getAll("novelIds").map(String).filter(Boolean);
  const requestedCount = intFromForm(formData.get("chapterCount")) || 1;
  const chapterCount = Math.min(Math.max(requestedCount, 1), 20);
  const instruction = textFromForm(formData, "instruction");
  if (!novelIds.length) {
    redirect("/novels?batch=empty");
  }

  const allowedNovels = await prisma.novel.findMany({
    where: { id: { in: novelIds }, userId: session.userId },
    select: { id: true },
  });
  for (const novel of allowedNovels) {
    await autoGenerateLatestChapters(novel.id, chapterCount, instruction);
  }
  revalidatePath("/novels");
  redirect(`/novels?batch=generated&count=${allowedNovels.length}`);
}

export async function markChapterPublishedAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const chapterId = textFromForm(formData, "chapterId");
  await requireOwnedNovelId(novelId);
  const publishedAtText = textFromForm(formData, "publishedAt");
  const publishedAt = publishedAtText ? new Date(publishedAtText) : new Date();
  if (!novelId || !chapterId || Number.isNaN(publishedAt.getTime())) {
    redirect(`/novels/${novelId}/publications?error=invalid`);
  }
  await prisma.publicationJob.upsert({
    where: { chapterId_platform: { chapterId, platform: "fanqie" } },
    update: {
      status: "PUBLISHED",
      scheduledAt: publishedAt,
      publishedAt,
      lastError: null,
    },
    create: {
      novelId,
      chapterId,
      platform: "fanqie",
      status: "PUBLISHED",
      scheduledAt: publishedAt,
      publishedAt,
    },
  });
  revalidatePath(`/novels/${novelId}/chapters`);
  revalidatePath(`/novels/${novelId}/publications`);
}

export async function createPublicationQueueAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const startDateText = textFromForm(formData, "startDate");
  const startChapterNumber = intFromForm(formData.get("startChapterNumber"));
  const maxDailyWords = intFromForm(formData.get("maxDailyWords")) || 10000;
  if (!novelId) return;
  await requireOwnedNovelId(novelId);

  const startDate = startDateText ? new Date(`${startDateText}T00:00:00`) : new Date();
  if (Number.isNaN(startDate.getTime())) {
    redirect(`/novels/${novelId}/publications?error=invalid`);
  }
  const chapters = await prisma.chapter.findMany({
    where: {
      novelId,
      content: { not: null },
      chapterNumber: { gte: startChapterNumber || undefined },
      publicationJobs: {
        none: {
          platform: "fanqie",
          status: { in: ["PENDING", "RUNNING", "PUBLISHED"] },
        },
      },
    },
    orderBy: { chapterNumber: "asc" },
    select: { id: true, novelId: true, wordCount: true, content: true },
  });
  const scheduledTimes = buildWordBudgetPublicationTimes(
    startDate,
    chapters.map((chapter) => ({
      wordCount: chapter.wordCount || wordCount(chapter.content || ""),
    })),
    maxDailyWords,
  );

  for (let index = 0; index < chapters.length; index += 1) {
    const scheduledAt = scheduledTimes[index];
    const chapter = chapters[index];
    await prisma.publicationJob.upsert({
      where: { chapterId_platform: { chapterId: chapter.id, platform: "fanqie" } },
      update: {
        status: "PENDING",
        scheduledAt,
        lastError: null,
        publishedAt: null,
      },
      create: {
        novelId: chapter.novelId,
        chapterId: chapter.id,
        platform: "fanqie",
        scheduledAt,
      },
    });
  }
  revalidatePath(`/novels/${novelId}/publications`);
  revalidatePath(`/novels/${novelId}/chapters`);
}

function buildWordBudgetPublicationTimes(startDate: Date, chapters: { wordCount: number }[], maxDailyWords: number) {
  const result: Date[] = [];
  const minGapMinutes = 3;
  const dailyLimit = Math.max(maxDailyWords, 1);
  let dayOffset = 0;
  let wordsInDay = 0;
  let previousMinuteOfDay: number | null = null;

  for (const chapter of chapters) {
    const chapterWords = Math.max(chapter.wordCount || 0, 1);
    if (wordsInDay > 0 && wordsInDay + chapterWords > dailyLimit) {
      dayOffset += 1;
      wordsInDay = 0;
      previousMinuteOfDay = null;
    }

    const dayStartMinute = 12 * 60 + Math.floor(Math.random() * 11);
    const previousMinute = previousMinuteOfDay ?? dayStartMinute - minGapMinutes;
    const randomGap = minGapMinutes + Math.floor(Math.random() * 13);
    const minuteOfDay = Math.min(previousMinute + randomGap, 15 * 60 - 1);
    const scheduledAt = new Date(startDate);
    scheduledAt.setDate(startDate.getDate() + dayOffset);
    scheduledAt.setHours(Math.floor(minuteOfDay / 60), minuteOfDay % 60, 0, 0);
    result.push(scheduledAt);
    wordsInDay += chapterWords;
    previousMinuteOfDay = minuteOfDay;
  }
  return result;
}

export async function updateChapterAction(formData: FormData) {
  const id = textFromForm(formData, "chapterId");
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const old = await prisma.chapter.findFirstOrThrow({ where: { id, novelId } });
  const content = textFromForm(formData, "content") || null;
  if (old.content && old.content !== content) {
    await prisma.version.create({
      data: {
        novelId,
        targetType: "chapter_content",
        targetId: id,
        versionNumber: await nextVersion("chapter_content", id),
        title: old.title,
        content: old.content,
        changeSummary: "正文保存前自动归档",
      },
    });
  }
  await prisma.chapter.update({
    where: { id },
    data: {
      title: textFromForm(formData, "title") || old.title,
      outline: textFromForm(formData, "outline") || null,
      content,
      summary: textFromForm(formData, "summary") || null,
      wordCount: wordCount(content),
      outlineStatus: textFromForm(formData, "outlineStatus") as never,
      contentStatus: textFromForm(formData, "contentStatus") as never,
    },
  });
  await refreshNovelWordCount(novelId);
  revalidatePath(`/novels/${novelId}/chapters/${id}`);
}

export async function finalizeChapterAction(formData: FormData) {
  const id = textFromForm(formData, "chapterId");
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  await prisma.chapter.updateMany({ where: { id, novelId }, data: { contentStatus: "FINALIZED" } });
  revalidatePath(`/novels/${novelId}/chapters/${id}`);
}

export async function batchFinalizeChaptersAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const startChapterNumber = intFromForm(formData.get("startChapterNumber"));
  const endChapterNumber = intFromForm(formData.get("endChapterNumber"));
  const status = textFromForm(formData, "status");
  if (!novelId) return;
  await requireOwnedNovelId(novelId);

  await prisma.chapter.updateMany({
    where: {
      novelId,
      content: { not: null },
      chapterNumber: {
        gte: startChapterNumber || undefined,
        lte: endChapterNumber || undefined,
      },
      contentStatus: status && status !== "ANY" ? (status as never) : undefined,
    },
    data: { contentStatus: "FINALIZED" },
  });
  revalidatePath(`/novels/${novelId}/chapters`);
}

export async function createCharacterAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const character = await prisma.character.create({
    data: {
      novelId,
      name: textFromForm(formData, "name") || "未命名人物",
      identity: textFromForm(formData, "identity") || null,
      personality: textFromForm(formData, "personality") || null,
      abilities: textFromForm(formData, "abilities") || null,
      cultivationLevel: textFromForm(formData, "cultivationLevel") || null,
      relationshipWithProtagonist: textFromForm(formData, "relationshipWithProtagonist") || null,
      currentStatus: textFromForm(formData, "currentStatus") || null,
      notes: textFromForm(formData, "notes") || null,
    },
  });
  await prisma.characterStateHistory.create({
    data: {
      novelId,
      characterId: character.id,
      powerLevel: character.cultivationLevel,
      relationship: character.relationshipWithProtagonist,
      eventSummary: character.currentStatus || character.notes || "手动创建人物",
      source: "user",
    },
  });
  revalidatePath(`/novels/${novelId}/characters`);
}

export async function createWorldSettingAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const setting = await prisma.worldSetting.create({
    data: {
      novelId,
      title: textFromForm(formData, "title") || "未命名设定",
      category: textFromForm(formData, "category") || "world",
      content: textFromForm(formData, "content"),
      importance: intFromForm(formData.get("importance")) || 3,
    },
  });
  await prisma.worldSettingRevision.create({
    data: {
      novelId,
      worldSettingId: setting.id,
      newContent: setting.content,
      changeReason: "手动创建设定",
      createdBy: "user",
    },
  });
  revalidatePath(`/novels/${novelId}/world`);
}

export async function createForbiddenTermAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const term = textFromForm(formData, "term");
  if (!term) return;
  await prisma.forbiddenTerm.create({
    data: {
      novelId,
      term,
      category: textFromForm(formData, "category") || "meme",
      note: textFromForm(formData, "note") || null,
      severity: intFromForm(formData.get("severity")) || 3,
    },
  });
  revalidatePath(`/novels/${novelId}/banned`);
}

export async function createAiModelConfigAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const purpose = textFromForm(formData, "purpose")
    .split(/[,\s，、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  await prisma.aiModelConfig.create({
    data: {
      name: textFromForm(formData, "name") || "未命名模型",
      provider: textFromForm(formData, "provider") || "openai_compatible",
      baseUrl: textFromForm(formData, "baseUrl") || process.env.DEEPSEEK_BASE_URL || "",
      apiKeyRef: textFromForm(formData, "apiKeyRef") || "DEEPSEEK_API_KEY",
      model: textFromForm(formData, "model") || process.env.DEEPSEEK_MODEL || "deepseek-chat",
      purpose,
      temperature: Number.isFinite(Number(formData.get("temperature"))) ? Number(formData.get("temperature")) : null,
      maxTokens: intFromForm(formData.get("maxTokens")),
    },
  });
  revalidatePath(`/novels/${novelId}/ai-models`);
}

export async function toggleAiModelConfigAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const id = textFromForm(formData, "id");
  await requireOwnedNovelId(novelId);
  const config = await prisma.aiModelConfig.findUnique({ where: { id } });
  if (config) {
    await prisma.aiModelConfig.update({ where: { id }, data: { enabled: !config.enabled } });
  }
  revalidatePath(`/novels/${novelId}/ai-models`);
}

export async function deleteForbiddenTermAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const id = textFromForm(formData, "id");
  await requireOwnedNovelId(novelId);
  if (id) {
    await prisma.forbiddenTerm.deleteMany({ where: { id, novelId } });
  }
  revalidatePath(`/novels/${novelId}/banned`);
}

export async function aiAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  const targetType = textFromForm(formData, "targetType");
  const targetId = textFromForm(formData, "targetId") || null;
  const taskType = textFromForm(formData, "taskType");
  const novel = await prisma.novel.findUniqueOrThrow({
    where: { id: novelId },
    include: {
      settings: true,
      volumes: { orderBy: { startChapterNumber: "asc" } },
      characters: { orderBy: { updatedAt: "desc" }, take: 20 },
      worldSettings: { orderBy: { importance: "desc" }, take: 20 },
      forbiddenTerms: { orderBy: [{ severity: "desc" }, { updatedAt: "desc" }], take: 80 },
    },
  });
  const chapter = targetId ? await prisma.chapter.findFirst({ where: { id: targetId, novelId } }) : null;
  let instruction = textFromForm(formData, "instruction");
  if (chapter && taskType === "chapter_content") {
    const additions = await latestPrecheckPromptAdditions(novelId, chapter.id);
    if (additions) {
      instruction = [instruction, `【生成前检查建议】\n${additions}`].filter(Boolean).join("\n\n");
    }
  }
  let prompt = buildPrompt(taskType, novel, chapter, instruction);
  if (chapter && ["chapter_content", "chapter_outline", "review_chapter", "precheck_chapter"].includes(taskType)) {
    prompt += await buildChapterLocalContext(novelId, chapter.chapterNumber, chapter.volumeId);
  }
  if (chapter && taskType === "chapter_content") {
    prompt += await buildMemoryPromptContext(novelId, chapter, instruction);
  }
  const task = await prisma.aiTask.create({
    data: {
      novelId,
      targetType,
      targetId,
      taskType,
      status: "RUNNING",
      prompt,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      startedAt: new Date(),
    },
  });

  let redirectPath = `/novels/${novelId}/ai-tasks`;
  try {
    const output = await callDeepSeek([
      {
        role: "system",
        content: taskType === "precheck_chapter" || taskType === "review_chapter"
          ? "你是中文网文创作后台的专业 AI 助手。必须输出严格 JSON，不要 Markdown，不要寒暄。"
          : "你是中文网文创作后台的专业 AI 助手。输出直接可编辑的中文内容，不要寒暄。",
      },
      { role: "user", content: prompt },
    ], {
      responseFormat: taskType === "precheck_chapter" || taskType === "review_chapter" ? "json" : "text",
      temperature: taskType.includes("review") || taskType === "precheck_chapter" ? Number(process.env.AI_REVIEW_TEMPERATURE ?? 0.3) : undefined,
    });

    await prisma.aiTask.update({
      where: { id: task.id },
      data: { status: "SUCCESS", outputContent: output, finishedAt: new Date() },
    });

    if (taskType === "global_outline") {
      const existing = await prisma.novelSetting.findFirst({ where: { novelId, type: "global_outline" } });
      if (existing) {
        await prisma.novelSetting.update({ where: { id: existing.id }, data: { content: output } });
      } else {
        await prisma.novelSetting.create({ data: { novelId, type: "global_outline", title: "总大纲", content: output } });
      }
      redirectPath = `/novels/${novelId}/outlines`;
    } else if (chapter && taskType === "chapter_outline") {
      await prisma.chapter.update({ where: { id: chapter.id }, data: { outline: output, outlineStatus: "PENDING_CONFIRM" } });
      redirectPath = `/novels/${novelId}/chapters/${chapter.id}`;
    } else if (chapter && taskType === "chapter_content") {
      const validation = validateGeneratedChapter(output, novel, chapter);
      const validationText = formatChapterValidationResult(validation);
      if (chapter.content) {
        await prisma.version.create({
          data: {
            novelId,
            targetType: "chapter_content",
            targetId: chapter.id,
            versionNumber: await nextVersion("chapter_content", chapter.id),
            title: chapter.title,
            content: chapter.content,
            changeSummary: "AI 覆盖正文前自动归档",
          },
        });
      }
      await prisma.chapter.update({
        where: { id: chapter.id },
        data: {
          content: output,
          wordCount: wordCount(output),
          contentStatus: validation.passed ? "PENDING_REVIEW" : "NEED_REVISION",
          aiReviewStatus: validationText,
        },
      });
      await prisma.aiTask.update({
        where: { id: task.id },
        data: { outputContent: `${output}\n\n${validationText}` },
      });
      await summarizeAndReviewChapter(novel, novelId, chapter.id, output);
      await indexChapterMemory(novelId, chapter.id);
      await refreshNovelWordCount(novelId);
      redirectPath = `/novels/${novelId}/chapters/${chapter.id}`;
    } else if (chapter && taskType === "review_chapter") {
      const reviewText = formatStructuredReview(output);
      await saveStructuredChapterReview(novelId, chapter.id, output);
      await prisma.chapter.update({ where: { id: chapter.id }, data: { aiReviewStatus: reviewText, contentStatus: "NEED_REVISION" } });
      redirectPath = `/novels/${novelId}/chapters/${chapter.id}`;
    } else if (chapter && taskType === "precheck_chapter") {
      const precheckText = formatPrecheckResult(output);
      await prisma.chapter.update({ where: { id: chapter.id }, data: { aiReviewStatus: precheckText } });
      redirectPath = `/novels/${novelId}/chapters/${chapter.id}`;
    }
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error), finishedAt: new Date() },
    });
    redirectPath = `/novels/${novelId}/ai-tasks`;
  }
  redirect(redirectPath);
}

export async function retryAiTaskAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const taskId = textFromForm(formData, "taskId");
  await requireOwnedNovelId(novelId);
  const task = await prisma.aiTask.findFirst({ where: { id: taskId, novelId } });
  if (!task || task.status !== "FAILED" || !task.prompt) {
    redirect(`/novels/${novelId}/ai-tasks`);
  }

  await prisma.aiTask.update({
    where: { id: task.id },
    data: {
      status: "RUNNING",
      errorMessage: null,
      attempts: { increment: 1 },
      startedAt: new Date(),
      finishedAt: null,
    },
  });

  try {
    const output = await callDeepSeek(
      [
        {
          role: "system",
          content: task.taskType === "precheck_chapter" || task.taskType === "review_chapter"
            ? "你是中文网文创作后台的专业 AI 助手。必须输出严格 JSON，不要 Markdown，不要寒暄。"
            : "你是中文网文创作后台的专业 AI 助手。输出直接可编辑的中文内容，不要寒暄。",
        },
        { role: "user", content: task.prompt },
      ],
      {
        responseFormat: task.taskType === "precheck_chapter" || task.taskType === "review_chapter" ? "json" : "text",
        temperature: task.taskType.includes("review") || task.taskType === "precheck_chapter"
          ? Number(process.env.AI_REVIEW_TEMPERATURE ?? 0.3)
          : undefined,
      },
    );
    await prisma.aiTask.update({
      where: { id: task.id },
      data: { status: "SUCCESS", outputContent: output, finishedAt: new Date() },
    });
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
  }
  redirect(`/novels/${novelId}/ai-tasks`);
}

export async function generateRevisionFromReviewAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const chapterId = textFromForm(formData, "chapterId");
  const reviewId = textFromForm(formData, "reviewId");
  const instruction = textFromForm(formData, "instruction");
  await requireOwnedNovelId(novelId);
  const novel = await loadNovelForPrompt(novelId);
  const chapter = await prisma.chapter.findFirstOrThrow({ where: { id: chapterId, novelId } });
  const review = await prisma.chapterReview.findFirstOrThrow({
    where: { id: reviewId, novelId, chapterId },
    include: { issues: { orderBy: { createdAt: "asc" } } },
  });
  const prompt = buildRevisionPrompt(novel, chapter, review, instruction)
    + await buildChapterLocalContext(novelId, chapter.chapterNumber, chapter.volumeId);
  const output = await runAiTask({
    novelId,
    targetType: "chapter_revision",
    targetId: chapterId,
    taskType: "revise_chapter_from_review",
    prompt,
    systemPrompt: "你是中文长篇网文修稿助手。只输出修订后的完整正文，不要解释，不要 Markdown。",
    temperature: Number(process.env.AI_REVISION_TEMPERATURE ?? 0.45),
  });
  await prisma.chapterRevision.create({
    data: {
      novelId,
      chapterId,
      sourceReviewId: review.id,
      revisionNo: await nextChapterRevisionNo(chapterId),
      instruction: instruction || null,
      content: output,
      wordCount: wordCount(output),
    },
  });
  revalidatePath(`/novels/${novelId}/chapters/${chapterId}`);
}

export async function applyChapterRevisionAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const chapterId = textFromForm(formData, "chapterId");
  const revisionId = textFromForm(formData, "revisionId");
  await requireOwnedNovelId(novelId);
  const [chapter, revision] = await Promise.all([
    prisma.chapter.findFirstOrThrow({ where: { id: chapterId, novelId } }),
    prisma.chapterRevision.findFirstOrThrow({ where: { id: revisionId, chapterId, novelId } }),
  ]);
  if (revision.status !== "DRAFT") {
    revalidatePath(`/novels/${novelId}/chapters/${chapterId}`);
    return;
  }
  let baseVersionId: string | undefined;
  if (chapter.content) {
    const version = await prisma.version.create({
      data: {
        novelId,
        targetType: "chapter_content",
        targetId: chapter.id,
        versionNumber: await nextVersion("chapter_content", chapter.id),
        title: chapter.title,
        content: chapter.content,
        changeSummary: `应用修订版 v${revision.revisionNo} 前自动归档`,
      },
    });
    baseVersionId = version.id;
  }
  await prisma.$transaction([
    prisma.chapter.update({
      where: { id: chapter.id },
      data: {
        content: revision.content,
        wordCount: wordCount(revision.content),
        contentStatus: "PENDING_REVIEW",
      },
    }),
    prisma.chapterRevision.update({
      where: { id: revision.id },
      data: { status: "APPLIED", baseVersionId },
    }),
    ...(revision.sourceReviewId
      ? [prisma.chapterReview.update({ where: { id: revision.sourceReviewId }, data: { status: "FIXED" } })]
      : []),
  ]);
  await refreshNovelWordCount(novelId);
  revalidatePath(`/novels/${novelId}/chapters/${chapterId}`);
}

export async function discardChapterRevisionAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const chapterId = textFromForm(formData, "chapterId");
  const revisionId = textFromForm(formData, "revisionId");
  await requireOwnedNovelId(novelId);
  await prisma.chapterRevision.updateMany({
    where: { id: revisionId, chapterId, novelId, status: "DRAFT" },
    data: { status: "DISCARDED" },
  });
  revalidatePath(`/novels/${novelId}/chapters/${chapterId}`);
}

export async function rebuildNovelMemoryAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  await requireOwnedNovelId(novelId);
  await rebuildNovelMemory(novelId);
  revalidatePath(`/novels/${novelId}/memory`);
}

export async function indexChapterMemoryAction(formData: FormData) {
  const novelId = textFromForm(formData, "novelId");
  const chapterId = textFromForm(formData, "chapterId");
  await requireOwnedNovelId(novelId);
  if (chapterId) {
    await indexChapterMemory(novelId, chapterId);
  }
  revalidatePath(`/novels/${novelId}/memory`);
  revalidatePath(`/novels/${novelId}/chapters/${chapterId}`);
}

async function latestPrecheckPromptAdditions(novelId: string, chapterId: string) {
  const task = await prisma.aiTask.findFirst({
    where: {
      novelId,
      targetType: "chapter",
      targetId: chapterId,
      taskType: "precheck_chapter",
      status: "SUCCESS",
      outputContent: { not: null },
    },
    orderBy: { finishedAt: "desc" },
    select: { outputContent: true },
  });
  if (!task?.outputContent) return "";
  try {
    const parsed = parseJsonPayload(task.outputContent) as { suggestedPromptAdditions?: unknown };
    return typeof parsed.suggestedPromptAdditions === "string" ? parsed.suggestedPromptAdditions.trim().slice(0, 1500) : "";
  } catch {
    return "";
  }
}

function formatPrecheckResult(output: string) {
  try {
    const parsed = parseJsonPayload(output) as {
      canGenerate?: boolean;
      riskLevel?: string;
      issues?: { type?: string; severity?: string; message?: string; suggestion?: string }[];
      suggestedPromptAdditions?: string;
    };
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    return [
      "【生成前检查】",
      `能否生成：${parsed.canGenerate === false ? "建议先修正" : "可以继续生成"}`,
      `风险等级：${parsed.riskLevel || "unknown"}`,
      "",
      "问题：",
      ...(issues.length
        ? issues.map((item) => `- [${item.severity || "info"}] ${item.message || item.type || "未命名问题"}${item.suggestion ? ` 建议：${item.suggestion}` : ""}`)
        : ["- 未发现明显阻断问题。"]),
      parsed.suggestedPromptAdditions ? `\n建议自动拼入正文 Prompt：\n${parsed.suggestedPromptAdditions}` : "",
    ].filter(Boolean).join("\n");
  } catch {
    return `【生成前检查】\n${output}`;
  }
}

function formatStructuredReview(output: string) {
  try {
    const parsed = parseJsonPayload(output) as {
      overallScore?: number;
      summary?: string;
      mustFixBeforeFinalize?: boolean;
      issues?: { type?: string; severity?: string; title?: string; evidence?: string; explanation?: string; suggestion?: string }[];
    };
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    return [
      "【结构化审稿】",
      `评分：${typeof parsed.overallScore === "number" ? parsed.overallScore : "未给出"}`,
      `定稿前必须修复：${parsed.mustFixBeforeFinalize ? "是" : "否"}`,
      parsed.summary ? `摘要：${parsed.summary}` : "",
      "",
      "问题清单：",
      ...(issues.length
        ? issues.map((item, index) => [
            `${index + 1}. [${item.severity || "info"} / ${item.type || "general"}] ${item.title || "未命名问题"}`,
            item.evidence ? `证据：${item.evidence}` : "",
            item.explanation ? `说明：${item.explanation}` : "",
            item.suggestion ? `建议：${item.suggestion}` : "",
          ].filter(Boolean).join("\n"))
        : ["未发现明确问题。"]),
      "",
      "原始 JSON：",
      output,
    ].filter(Boolean).join("\n");
  } catch {
    return `【结构化审稿解析失败，保留原始输出】\n${output}`;
  }
}

async function saveStructuredChapterReview(novelId: string, chapterId: string, output: string) {
  let parsed: {
    overallScore?: unknown;
    summary?: unknown;
    issues?: {
      type?: unknown;
      severity?: unknown;
      title?: unknown;
      evidence?: unknown;
      explanation?: unknown;
      suggestion?: unknown;
    }[];
  };
  try {
    parsed = parseJsonPayload(output) as typeof parsed;
  } catch {
    parsed = {
      summary: "审稿 JSON 解析失败，已保存原始输出。",
      issues: [{
        type: "format",
        severity: "medium",
        title: "审稿输出不是可解析 JSON",
        explanation: "AI 审稿结果无法结构化解析，请查看 rawOutput。",
        suggestion: "重新执行结构化审稿。",
      }],
    };
  }
  const issues = Array.isArray(parsed.issues) ? parsed.issues.slice(0, 80) : [];
  await prisma.chapterReview.create({
    data: {
      novelId,
      chapterId,
      reviewNo: await nextChapterReviewNo(chapterId),
      overallScore: typeof parsed.overallScore === "number" ? parsed.overallScore : null,
      summary: cleanOptionalText(parsed.summary, 2000) || null,
      rawOutput: output,
      issues: {
        create: issues.map((issue, index) => ({
          type: cleanOptionalText(issue.type, 40) || "general",
          severity: cleanOptionalText(issue.severity, 30) || "medium",
          title: cleanOptionalText(issue.title, 120) || `问题 ${index + 1}`,
          evidence: cleanOptionalText(issue.evidence, 1000),
          explanation: cleanOptionalText(issue.explanation, 2000) || "AI 未提供详细说明。",
          suggestion: cleanOptionalText(issue.suggestion, 2000),
        })),
      },
    },
  });
}

async function loadNovelForPrompt(novelId: string) {
  return prisma.novel.findUniqueOrThrow({
    where: { id: novelId },
    include: {
      settings: true,
      volumes: { orderBy: { startChapterNumber: "asc" } },
      characters: { orderBy: { updatedAt: "desc" }, take: 20 },
      worldSettings: { orderBy: { importance: "desc" }, take: 20 },
      forbiddenTerms: { orderBy: [{ severity: "desc" }, { updatedAt: "desc" }], take: 80 },
    },
  });
}

async function runAiTask({
  novelId,
  targetType,
  targetId,
  taskType,
  prompt,
  systemPrompt,
  temperature,
}: {
  novelId: string;
  targetType: string;
  targetId: string;
  taskType: string;
  prompt: string;
  systemPrompt: string;
  temperature?: number;
}) {
  const task = await prisma.aiTask.create({
    data: {
      novelId,
      targetType,
      targetId,
      taskType,
      status: "RUNNING",
      prompt,
      model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
      startedAt: new Date(),
    },
  });

  try {
    const output = await callDeepSeek(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      { temperature },
    );
    await prisma.aiTask.update({
      where: { id: task.id },
      data: { status: "SUCCESS", outputContent: output, finishedAt: new Date() },
    });
    return output;
  } catch (error) {
    await prisma.aiTask.update({
      where: { id: task.id },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

async function nextVersion(targetType: string, targetId: string) {
  return (
    (await prisma.version.count({
      where: { targetType, targetId },
    })) + 1
  );
}

async function nextChapterReviewNo(chapterId: string) {
  return (await prisma.chapterReview.count({ where: { chapterId } })) + 1;
}

async function nextChapterRevisionNo(chapterId: string) {
  return (await prisma.chapterRevision.count({ where: { chapterId } })) + 1;
}

async function refreshNovelWordCount(novelId: string) {
  const chapters = await prisma.chapter.findMany({ where: { novelId }, select: { wordCount: true } });
  await prisma.novel.update({
    where: { id: novelId },
    data: { currentWords: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0) },
  });
}

async function buildChapterLocalContext(novelId: string, chapterNumber: number, volumeId?: string | null) {
  const recentChapters = await prisma.chapter.findMany({
    where: {
      novelId,
      chapterNumber: { lt: chapterNumber },
      OR: [{ summary: { not: null } }, { content: { not: null } }],
    },
    orderBy: { chapterNumber: "desc" },
    take: 6,
    select: { chapterNumber: true, title: true, summary: true, content: true },
  });
  const volume = volumeId ? await prisma.volume.findUnique({ where: { id: volumeId } }) : null;
  const previousChapter = recentChapters[0];
  const previousMemory = previousChapter
    ? `上一章（第${previousChapter.chapterNumber}章《${previousChapter.title}》）必须承接：${
        previousChapter.summary || previousChapter.content?.slice(0, 1200) || ""
      }`
    : "这是开篇章节，尚无上一章记忆。";
  const summaries = recentChapters
    .slice()
    .reverse()
    .map((item) => `第${item.chapterNumber}章《${item.title}》：${item.summary || item.content?.slice(0, 700) || ""}`)
    .join("\n");

  return `

上一章主要内容（生成本章时优先级最高）：
${previousMemory}

当前卷纲补充：${volume ? `卷名：${volume.title}
章节范围：${volume.startChapterNumber}-${volume.endChapterNumber}
概要：${volume.summary || ""}
本卷目标：${volume.mainGoal || ""}
主要冲突：${volume.mainConflict || ""}
主要敌人/阻力：${volume.mainEnemy || ""}
关键人物：${volume.keyCharacters || ""}
关键设定：${volume.keySettings || ""}
卷末高潮：${volume.climax || ""}` : "当前章节未关联分卷。"}

最近章节记忆：
${summaries || "这是开篇或前文摘要尚未建立。"}

连续性要求：
0. 如果本章不是第一章，必须先承接上一章结尾的人物位置、伤势、关系、持有物、线索和未解决冲突，再推进新剧情。
1. 必须承接最近章节已经发生的事实，不要改写既有结果。
2. 人物状态、境界、伤势、持有物、关系变化必须与最近章节记忆一致。
3. 本章只推进当前细纲要求的剧情，不要提前透支后续卷纲高潮。
4. 禁用烂梗库中的表达不能使用，类似表达也要避开。`;
}

async function buildMemoryPromptContext(novelId: string, chapter: NonNullable<PromptChapter>, instruction: string) {
  const query = [
    chapter.title,
    chapter.outline || "",
    instruction,
  ].filter(Boolean).join("\n");
  const chunks = await searchNovelMemory(novelId, query, {
    topK: 8,
    beforeChapterNumber: chapter.chapterNumber,
  });
  return formatMemoryForPrompt(chunks);
}

async function summarizeAndReviewChapter(novel: PromptNovel, novelId: string, chapterId: string, content: string) {
  try {
    const forbiddenText = novel.forbiddenTerms?.map((item) => item.term).join("、") || "无";
    const result = await callDeepSeek(
      [
        { role: "system", content: "你是长篇小说资料整理和连续性审稿助手。必须输出严格 JSON。" },
        {
          role: "user",
          content: `请根据本章正文输出 JSON：{
  "summary": "300字以内章节摘要，只记录确实发生的事实，必须可供下一章直接承接",
  "review": "连续性自审：列出是否偏离细纲、人物状态是否冲突、设定是否冲突、是否使用禁用烂梗、下一章需要记住的事项",
  "characterUpdates": [
    {
      "name": "人物姓名",
      "identity": "身份变化，可为空",
      "faction": "势力变化，可为空",
      "relationshipWithProtagonist": "与主角关系变化，可为空",
      "cultivationLevel": "境界/能力阶段变化，可为空",
      "items": "新增或失去的重要物品，可为空",
      "goal": "短期目标变化，可为空",
      "currentStatus": "本章结束时的明确状态、位置、伤势、情绪和立场",
      "importance": 1,
      "isImportant": true,
      "roleInChapter": "本章作用，例如主角/核心配角/反派/势力代表/关键证人/重要线索人物",
      "notes": "只记录本章新增的事实"
    }
  ],
  "worldUpdates": [
    {
      "title": "设定名",
      "category": "world/rule/faction/location/item/power",
      "content": "本章新增或确认的世界观事实",
      "importance": 1
    }
  ]
}

禁用烂梗：${forbiddenText}
角色回写规则：
1. 必须包含本章出场且状态发生变化的已有重要角色。
2. 新角色只有在重要度不低于 3，或后续可能反复出现、影响主线/伏笔/势力关系时才写入 characterUpdates。
3. 路人、无名杂兵、一次性背景人物不要写入 characterUpdates。
4. currentStatus 必须写成本章结束时的可承接状态，至少包含位置、行动结果、立场/情绪，若有伤势或物品变化也要写清。
正文：${content}`,
        },
      ],
      { responseFormat: "json", temperature: 0.2, maxTokens: 2500 },
    );
    const parsed = parseJsonPayload(result) as {
      summary?: string;
      review?: string;
      characterUpdates?: CharacterMemoryUpdate[];
      worldUpdates?: WorldMemoryUpdate[];
    };
    const existingChapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { aiReviewStatus: true, chapterNumber: true },
    });
    const reviewText = parsed.review ? String(parsed.review) : undefined;
    await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        summary: parsed.summary ? String(parsed.summary) : undefined,
        aiReviewStatus: reviewText
          ? [existingChapter?.aiReviewStatus, "【自动摘要自审】", reviewText].filter(Boolean).join("\n\n")
          : undefined,
      },
    });
    await applyChapterMemoryUpdates(novelId, parsed.characterUpdates, parsed.worldUpdates, {
      chapterId,
      chapterNumber: existingChapter?.chapterNumber,
    });
  } catch {
    // 摘要、自审、资料回写失败不应阻断正文保存。
  }
}

type CharacterMemoryUpdate = {
  name?: string;
  identity?: string;
  faction?: string;
  relationshipWithProtagonist?: string;
  cultivationLevel?: string;
  items?: string;
  goal?: string;
  currentStatus?: string;
  importance?: number;
  isImportant?: boolean;
  roleInChapter?: string;
  notes?: string;
};

type WorldMemoryUpdate = {
  title?: string;
  category?: string;
  content?: string;
  importance?: number;
};

async function applyChapterMemoryUpdates(
  novelId: string,
  characterUpdates?: CharacterMemoryUpdate[],
  worldUpdates?: WorldMemoryUpdate[],
  context: { chapterId?: string; chapterNumber?: number } = {},
) {
  for (const update of Array.isArray(characterUpdates) ? characterUpdates.slice(0, 12) : []) {
    const name = cleanShortText(update.name, 30);
    if (!name) continue;
    const existing = await findCharacterForMemoryUpdate(novelId, name);
    const importance = normalizePositiveInt(update.importance, 1);
    const isImportant = update.isImportant === true || importance >= 3;
    if (!existing && !isImportant) continue;
    const data = {
      identity: cleanOptionalText(update.identity, 80),
      faction: cleanOptionalText(update.faction, 80),
      relationshipWithProtagonist: cleanOptionalText(update.relationshipWithProtagonist, 160),
      cultivationLevel: cleanOptionalText(update.cultivationLevel, 120),
      items: cleanOptionalText(update.items, 500),
      goal: cleanOptionalText(update.goal, 300),
      currentStatus: cleanOptionalText(update.currentStatus, 800),
      notes: mergeNotes(
        existing?.notes,
        [
          update.roleInChapter ? `本章作用：${cleanShortText(update.roleInChapter, 120)}` : "",
          update.importance ? `重要度：${importance}` : "",
          cleanOptionalText(update.notes, 800) || "",
        ].filter(Boolean).join("\n"),
      ),
    };
    if (existing) {
      await prisma.character.update({ where: { id: existing.id }, data: compactData(data) });
      await prisma.characterStateHistory.create({
        data: {
          novelId,
          characterId: existing.id,
          chapterId: context.chapterId,
          chapterNumber: context.chapterNumber,
          powerLevel: data.cultivationLevel,
          items: data.items,
          relationship: data.relationshipWithProtagonist,
          goal: data.goal,
          eventSummary: data.currentStatus || cleanOptionalText(update.notes, 800),
          source: "ai",
        },
      });
    } else {
      const created = await prisma.character.create({
        data: {
          novelId,
          name,
          identity: data.identity || "重要新出场人物",
          faction: data.faction,
          relationshipWithProtagonist: data.relationshipWithProtagonist,
          cultivationLevel: data.cultivationLevel,
          items: data.items,
          goal: data.goal,
          currentStatus: data.currentStatus || "本章新增人物",
          notes: data.notes,
        },
      });
      await prisma.characterStateHistory.create({
        data: {
          novelId,
          characterId: created.id,
          chapterId: context.chapterId,
          chapterNumber: context.chapterNumber,
          powerLevel: data.cultivationLevel,
          items: data.items,
          relationship: data.relationshipWithProtagonist,
          goal: data.goal,
          eventSummary: data.currentStatus || cleanOptionalText(update.notes, 800) || "本章新增人物",
          source: "ai",
        },
      });
    }
  }

  for (const update of Array.isArray(worldUpdates) ? worldUpdates.slice(0, 10) : []) {
    const title = cleanShortText(update.title, 60);
    const content = cleanOptionalText(update.content, 1200);
    if (!title || !content) continue;
    const category = cleanShortText(update.category, 40) || "chapter_memory";
    const existing = await prisma.worldSetting.findFirst({ where: { novelId, title, category } });
    if (existing) {
      const newContent = mergeNotes(existing.content, content) || content;
      await prisma.worldSetting.update({
        where: { id: existing.id },
        data: {
          content: newContent,
          importance: Math.max(existing.importance, normalizePositiveInt(update.importance, 2)),
        },
      });
      await prisma.worldSettingRevision.create({
        data: {
          novelId,
          worldSettingId: existing.id,
          chapterId: context.chapterId,
          chapterNumber: context.chapterNumber,
          oldContent: existing.content,
          newContent,
          changeReason: "章节摘要回写",
          createdBy: "ai",
        },
      });
    } else {
      const created = await prisma.worldSetting.create({
        data: {
          novelId,
          title,
          category,
          content,
          importance: normalizePositiveInt(update.importance, 2),
        },
      });
      await prisma.worldSettingRevision.create({
        data: {
          novelId,
          worldSettingId: created.id,
          chapterId: context.chapterId,
          chapterNumber: context.chapterNumber,
          newContent: content,
          changeReason: "章节摘要新增",
          createdBy: "ai",
        },
      });
    }
  }
}

function extractCharacterName(text: string) {
  const match = text.match(/(?:姓名|名字|名称|称谓)[:：]\s*([^\n，,；;]+)/);
  return match?.[1]?.trim().slice(0, 30);
}

function buildInitialCharacterCreates(protagonist: string, mainCharacters: string) {
  const creates: Array<{
    name: string;
    identity?: string;
    faction?: string;
    personality?: string;
    relationshipWithProtagonist?: string;
    goal?: string;
    currentStatus?: string;
    notes?: string;
  }> = [];
  const seen = new Set<string>();

  function addCharacter(block: string, fallbackIdentity: string) {
    const notes = block.trim();
    if (!notes) return;
    const name = extractReadableCharacterName(notes, creates.length + 1);
    if (!name || seen.has(name)) return;
    seen.add(name);
    creates.push({
      name,
      identity: extractLabeledValue(notes, "身份") || fallbackIdentity,
      faction: extractLabeledValue(notes, "势力"),
      personality: extractLabeledValue(notes, "性格"),
      relationshipWithProtagonist: extractLabeledValue(notes, "与主角关系") || extractLabeledValue(notes, "关系"),
      goal: extractLabeledValue(notes, "目标"),
      currentStatus:
        extractLabeledValue(notes, "当前状态") ||
        extractLabeledValue(notes, "初始状态") ||
        extractLabeledValue(notes, "状态") ||
        extractLabeledValue(notes, "当前处境") ||
        extractLabeledValue(notes, "初始处境") ||
        buildInitialStatusFromFreeText(notes) ||
        "初始设定",
      notes,
    });
  }

  addCharacter(protagonist, "主角");
  splitCharacterBlocks(mainCharacters).slice(0, 24).forEach((block) => addCharacter(block, "主要人物"));
  return creates;
}

function splitCharacterBlocks(text: string) {
  return text
    .replace(/\r/g, "")
    .split(/\n(?=\s*(?:[-*]|\d+[.、]|[一二三四五六七八九十]+[、.]))|\n{2,}/)
    .map((item) => item.replace(/^\s*(?:[-*]|\d+[.、]|[一二三四五六七八九十]+[、.])\s*/, "").trim())
    .filter(Boolean);
}

function extractReadableCharacterName(text: string, index: number) {
  return (
    extractCharacterName(text) ||
    extractLabeledValue(text, "姓名") ||
    extractLabeledValue(text, "名字") ||
    extractLabeledValue(text, "名称") ||
    extractLabeledValue(text, "称呼") ||
    text.match(/^([^：:，,；;\n]{2,12})/)?.[1]?.trim() ||
    `人物${index}`
  ).slice(0, 30);
}

function extractLabeledValue(text: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp(`${escaped}\\s*[:：]\\s*([^\\n；;，,]+)`));
  return match?.[1]?.trim().slice(0, 500);
}

function buildInitialStatusFromFreeText(text: string) {
  const statusHints = text
    .split(/[。！？\n]/)
    .map((item) => item.trim())
    .filter((item) => /(开局|初始|当前|处境|状态|位置|伤势|被困|被逐|失去|拥有|情绪|立场)/.test(item))
    .slice(0, 3);
  return statusHints.length ? statusHints.join("。").slice(0, 500) : undefined;
}

function cleanShortText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanOptionalText(value: unknown, maxLength: number) {
  const text = cleanShortText(value, maxLength);
  return text || undefined;
}

function compactData<T extends Record<string, unknown>>(data: T) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== "")) as T;
}

function mergeNotes(existing?: string | null, addition?: string) {
  if (!addition) return existing || undefined;
  if (!existing) return addition;
  return `${existing}\n\n${addition}`.slice(-4000);
}
function buildNovelIdeaPrompt(description: string) {
  return `你是中文网文产品策划和长篇小说规划助手。请根据用户的一段简单描述，生成一个字段完整、可继续编辑的小说项目方案。
用户描述：${description}

硬性要求：
1. 必须完整填写所有 JSON 字段，不要留空，不要写“待定”。
2. 书名给一个最推荐的正式书名，不要返回数组。
3. 简介要体现主角、金手指/核心能力、世界观规则、核心矛盾和长期目标。
4. 总大纲必须显式使用 sellingPoint、protagonist、mainCharacters、worldSetting、mainGoal、finalGoal 里的关键元素。
5. 总大纲至少包含：开局钩子、前30章看点、前三卷推进、中期高潮、后期真相、最终对冲、结局方向、关键伏笔与回收。
6. protagonist 必须输出为对象，包含 name、identity、faction、personality、goal、currentStatus、notes；currentStatus 必须写清初始位置/处境/资源/伤势或限制/情绪与立场，不能只写“正常”。
7. mainCharacters 必须至少 5 个，覆盖主角核心伙伴、早期反派、长期反派、势力代表、关键关系人物。每个人物都要写清：姓名、身份、势力、与主角关系、性格、目标、初始状态、可埋伏笔。
8. worldSetting 必须至少 800 字，包含：世界结构、力量体系、核心规则、主要势力、资源/货币/禁忌、地理格局、社会秩序、会制造冲突的限制。
9. mainGoal 要写全书主要任务/主线任务链，不只写一句口号；finalGoal 要写终局对决和最终状态。

请只输出 JSON，不要 Markdown，不要解释。字段如下：
{
  "title": "书名",
  "type": "大类型，如玄幻、都市、科幻、悬疑",
  "subtype": "子类型，如升级流、系统流、废柴流、凡人流",
  "sellingPoint": "一句话卖点",
  "summary": "300字以内简介",
  "targetChapters": 100,
  "targetWordsPerChapter": 2500,
  "stylePreference": "写作风格、节奏、语感要求",
  "forbiddenRules": "需要避免的内容或写法",
  "mainGoal": "全书主要任务/主线任务链",
  "finalGoal": "终局目标和结局状态",
  "globalOutline": "完整总大纲",
  "protagonist": {
    "name": "主角姓名",
    "identity": "初始身份",
    "faction": "所属势力或无势力",
    "personality": "性格",
    "goal": "核心欲望和短期目标",
    "currentStatus": "开局时的明确状态、位置、处境、资源、伤势/限制、情绪和立场",
    "notes": "能力/金手指、弱点、成长弧线、可埋伏笔"
  },
  "mainCharacters": [
    {
      "name": "人物名",
      "identity": "身份",
      "faction": "势力",
      "relationshipWithProtagonist": "与主角关系",
      "personality": "性格",
      "goal": "目标",
      "currentStatus": "初始状态",
      "notes": "伏笔或备注"
    }
  ],
  "worldSetting": "完整世界观或核心规则"
}`;
}

type PromptNovel = {
  title: string;
  type: string;
  subtype: string | null;
  sellingPoint: string | null;
  summary: string | null;
  targetChapters: number | null;
  stylePreference: string | null;
  forbiddenRules: string | null;
  mainGoal: string | null;
  finalGoal: string | null;
  targetWordsPerChapter: number | null;
  settings: { type: string; content: string }[];
  volumes: { title: string; startChapterNumber: number; endChapterNumber: number; summary: string | null; mainGoal: string | null; mainConflict: string | null }[];
  characters: { name: string; identity: string | null; personality: string | null; currentStatus: string | null }[];
  worldSettings: { category: string; title: string; content: string }[];
  forbiddenTerms?: { term: string; category: string; note: string | null; severity: number }[];
};

type PromptVolume = {
  id: string;
  title: string;
  summary: string | null;
  startChapterNumber: number;
  endChapterNumber: number;
  mainGoal: string | null;
  mainConflict: string | null;
  mainEnemy: string | null;
  keyCharacters: string | null;
  keySettings: string | null;
  climax: string | null;
};

type GeneratedVolume = {
  title: string;
  summary: string;
  startChapterNumber: number;
  endChapterNumber: number;
  mainGoal: string;
  mainConflict: string;
  mainEnemy?: string;
  keyCharacters?: string;
  keySettings?: string;
  foreshadowsToCreate?: string;
  foreshadowsToResolve?: string;
  climax?: string;
};

type GeneratedChapter = {
  chapterNumber: number;
  title: string;
  outline: string;
};

type PromptChapter = {
  id: string;
  chapterNumber: number;
  title: string;
  volumeId?: string | null;
  outline: string | null;
  content: string | null;
} | null;

function buildPrompt(taskType: string, novel: PromptNovel, chapter: PromptChapter, instruction: string) {
  const globalOutline = novel.settings.find((item) => item.type === "global_outline")?.content || "";
  const protagonist = novel.settings.find((item) => item.type === "protagonist")?.content || "";
  const volumeText = novel.volumes.map((item) => `《${item.title}》${item.startChapterNumber}-${item.endChapterNumber}章\n${item.summary || ""}\n目标：${item.mainGoal || ""}\n冲突：${item.mainConflict || ""}`).join("\n\n");
  const characterText = novel.characters.map((item) => `${item.name}：${item.identity || ""}；性格：${item.personality || ""}；状态：${item.currentStatus || ""}`).join("\n");
  const worldText = novel.worldSettings.map((item) => `${item.category}/${item.title}：${item.content}`).join("\n");
  const forbiddenText = novel.forbiddenTerms?.map((item) => `${item.term}（${item.category}，严重度${item.severity}）：${item.note || "禁止使用或尽量避免"}`).join("\n") || "";
  const recentSummaries = "";
  const base = `小说：${novel.title}
类型：${novel.type}${novel.subtype ? ` / ${novel.subtype}` : ""}
目标总章节：${novel.targetChapters || "未设置"}
卖点：${novel.sellingPoint || ""}
简介：${novel.summary || ""}
风格：${novel.stylePreference || ""}
禁忌：${novel.forbiddenRules || ""}
主线：${novel.mainGoal || ""}
终局：${novel.finalGoal || ""}
总大纲：
${globalOutline}
主角设定：
${protagonist}
分卷：
${volumeText}
人物：
${characterText}
世界观：
${worldText}
禁用烂梗/禁用表达库：
${forbiddenText || "无"}
最近章节摘要：
${recentSummaries || "生成具体正文时会优先使用当前章节附近摘要。"}
补充要求：
${instruction || "无"}`;

  if (taskType === "global_outline") {
    return `${base}

请生成一份适合中文网文连载的总大纲。

硬性要求：
0. 如果目标总章节已设置，必须按目标总章节规划全书，不能只规划到两三百章；例如目标为1000章时，总大纲必须覆盖第1章到第1000章的完整阶段。
1. 必须严格承接上面的书名、类型、卖点、简介、主角设定、世界观、主线目标、终局目标和禁忌事项，不要另起炉灶。
2. 必须把主角的初始处境、核心能力/金手指、弱点、成长弧线写进大纲推进。
3. 必须把世界观的力量体系、势力、资源、禁忌或限制转化为剧情冲突。
4. 必须包含：故事开局、前30章看点、分阶段成长路线、地图/势力扩展、核心冲突、关键爽点、关键伏笔与回收计划、中期高潮、后期真相、最终对决、结局方向。
5. 输出要可直接作为后续分卷和章节细纲的依据。`;
  }
  if (taskType === "chapter_outline") {
    return `${base}

当前章节：第 ${chapter?.chapterNumber} 章《${chapter?.title}》
已有细纲：${chapter?.outline || ""}

请生成本章细纲，包含本章目标、出场人物、场景、冲突点、爽点、信息增量、伏笔和结尾钩子。`;
  }
  if (taskType === "precheck_chapter") {
    return `${base}

当前章节：第 ${chapter?.chapterNumber} 章《${chapter?.title}》
章节细纲：
${chapter?.outline || ""}

请在生成正文前做质量检查，重点检查：
1. 当前章节是否有关联卷纲，细纲是否为空或明显偏离卷纲。
2. 上一章摘要是否足够承接。
3. 关键人物是否有当前状态，是否可能出现状态断裂。
4. 是否存在当前章节附近应推进或回收的重要伏笔。
5. 细纲、标题和补充要求是否命中禁用词或禁用烂梗。

只输出严格 JSON，不要 Markdown，不要解释，格式如下：
{
  "canGenerate": true,
  "riskLevel": "low",
  "issues": [
    {
      "type": "missing_previous_summary",
      "severity": "medium",
      "message": "上一章缺少摘要，可能影响承接。",
      "suggestion": "先重新生成上一章摘要。"
    }
  ],
  "suggestedPromptAdditions": "本章必须承接上一章主角受伤状态。"
}`;
  }
  if (taskType === "review_chapter") {
    return `${base}

章节细纲：
${chapter?.outline || ""}
章节正文：
${chapter?.content || ""}

请审稿，维度包括剧情承接、细纲完成度、人物状态一致性、世界观一致性、伏笔埋设/回收、节奏爽点、禁用词/烂梗、AI 味表达、错别字和病句。

只输出严格 JSON，不要 Markdown，不要解释，格式如下：
{
  "overallScore": 82,
  "summary": "本章承接基本成立，但反派动机略突兀。",
  "issues": [
    {
      "type": "character",
      "severity": "high",
      "title": "主角伤势恢复过快",
      "evidence": "原文句子...",
      "explanation": "上一章主角左臂重伤，本章直接高强度战斗。",
      "suggestion": "增加临时压制伤势的代价，或降低战斗强度。"
    }
  ],
  "mustFixBeforeFinalize": true
}`;
  }
  return `${base}

当前章节：第 ${chapter?.chapterNumber} 章《${chapter?.title}》
章节细纲：
${chapter?.outline || ""}

请根据细纲生成本章正文草稿。使用中文网文语感，推进具体剧情，强化行动、冲突和对话，结尾留钩子，字数尽量接近目标字数 ${novel.targetWordsPerChapter || 2500}。`;
}

function buildRevisionPrompt(
  novel: PromptNovel,
  chapter: NonNullable<PromptChapter>,
  review: {
    overallScore: number | null;
    summary: string | null;
    rawOutput: string | null;
    issues: { type: string; severity: string; title: string; evidence: string | null; explanation: string; suggestion: string | null }[];
  },
  instruction: string,
) {
  const issueText = review.issues.map((issue, index) => [
    `${index + 1}. [${issue.severity}/${issue.type}] ${issue.title}`,
    issue.evidence ? `证据：${issue.evidence}` : "",
    `说明：${issue.explanation}`,
    issue.suggestion ? `建议：${issue.suggestion}` : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  return `${buildPrompt("chapter_content", novel, chapter, [
    "这是根据结构化审稿生成修订版的任务。",
    "必须保留原章节的主要剧情事实、章节位置和关键设定，不要改成新章节。",
    "优先修复 blocking/high/medium 问题；低风险问题在不破坏节奏的前提下顺手优化。",
    "只输出修订后的完整正文，不要输出说明、标题、Markdown 或修改清单。",
    instruction ? `用户补充修订要求：${instruction}` : "",
  ].filter(Boolean).join("\n"))}

原正文：
${chapter.content || ""}

结构化审稿摘要：
评分：${review.overallScore ?? "未给出"}
${review.summary || ""}

审稿问题：
${issueText || review.rawOutput || "无结构化问题，但仍需润色正文。"}
`;
}

function buildVolumeOutlinesPrompt(novel: PromptNovel, instruction: string) {
  const targetChapters = novel.targetChapters || 200;
  const suggestedVolumeCount = Math.max(1, Math.ceil(targetChapters / 50));
  const globalOutline = novel.settings.find((item) => item.type === "global_outline")?.content || "";
  const protagonist = novel.settings.find((item) => item.type === "protagonist")?.content || "";
  const worldText = novel.worldSettings.map((item) => `${item.category}/${item.title}：${item.content}`).join("\n");

  return `你是中文长篇网文分卷规划助手。请根据小说方案和总大纲，生成完整分卷卷纲。

小说：${novel.title}
类型：${novel.type}${novel.subtype ? ` / ${novel.subtype}` : ""}
目标总章节：${targetChapters}
建议分卷数：${suggestedVolumeCount} 卷左右，每卷通常 30-80 章，但所有分卷必须连续覆盖 1-${targetChapters} 章。
卖点：${novel.sellingPoint || ""}
简介：${novel.summary || ""}
风格：${novel.stylePreference || ""}
禁忌：${novel.forbiddenRules || ""}
主线：${novel.mainGoal || ""}
终局：${novel.finalGoal || ""}
主角设定：
${protagonist}
世界观：
${worldText}
总大纲：
${globalOutline}
补充要求：
${instruction || "无"}

硬性要求：
1. 分卷必须从第1章开始，连续覆盖到第${targetChapters}章，不允许只规划前200章。
2. 每一卷都要承接总大纲，不要另起设定。
3. 每卷必须有卷名、章节范围、卷目标、主要冲突、主要敌人/阻力、关键人物、关键设定、伏笔埋设、伏笔回收、卷末高潮。
4. 输出严格 JSON，不要 Markdown，不要解释，格式如下：
{
  "volumes": [
    {
      "title": "卷名",
      "startChapterNumber": 1,
      "endChapterNumber": 50,
      "summary": "本卷概要",
      "mainGoal": "本卷目标",
      "mainConflict": "主要冲突",
      "mainEnemy": "主要敌人或阻力",
      "keyCharacters": "关键人物",
      "keySettings": "关键设定",
      "foreshadowsToCreate": "本卷埋设伏笔",
      "foreshadowsToResolve": "本卷回收伏笔",
      "climax": "卷末高潮"
    }
  ]
}`;
}

function buildChapterOutlinesPrompt(novel: PromptNovel, volume: PromptVolume, instruction: string) {
  const globalOutline = novel.settings.find((item) => item.type === "global_outline")?.content || "";
  const protagonist = novel.settings.find((item) => item.type === "protagonist")?.content || "";
  const worldText = novel.worldSettings.map((item) => `${item.category}/${item.title}：${item.content}`).join("\n");
  const chapterCount = volume.endChapterNumber - volume.startChapterNumber + 1;

  return `你是中文网文章节细纲规划助手。请根据总大纲和当前卷纲，批量生成本卷每一章的章节细纲。

小说：${novel.title}
目标总章节：${novel.targetChapters || "未设置"}
卖点：${novel.sellingPoint || ""}
风格：${novel.stylePreference || ""}
禁忌：${novel.forbiddenRules || ""}
主线：${novel.mainGoal || ""}
终局：${novel.finalGoal || ""}
主角设定：
${protagonist}
世界观：
${worldText}
总大纲：
${globalOutline}
当前卷纲：
卷名：${volume.title}
章节范围：${volume.startChapterNumber}-${volume.endChapterNumber}
概要：${volume.summary || ""}
本卷目标：${volume.mainGoal || ""}
主要冲突：${volume.mainConflict || ""}
主要敌人/阻力：${volume.mainEnemy || ""}
关键人物：${volume.keyCharacters || ""}
关键设定：${volume.keySettings || ""}
卷末高潮：${volume.climax || ""}
补充要求：
${instruction || "无"}

硬性要求：
1. 必须生成第${volume.startChapterNumber}章到第${volume.endChapterNumber}章，共${chapterCount}章，一章都不能少。
2. 每章必须服务于当前卷目标和卷末高潮，不能脱离卷纲。
3. 每章细纲必须包含：本章目标、出场人物、场景、冲突点、爽点、信息增量、伏笔埋设/回收、结尾钩子。
4. 输出严格 JSON，不要 Markdown，不要解释，格式如下：
{
  "chapters": [
    {
      "chapterNumber": ${volume.startChapterNumber},
      "title": "章节标题",
      "outline": "完整章节细纲"
    }
  ]
}`;
}

function parseVolumeOutlines(output: string): GeneratedVolume[] {
  const data = parseJsonPayload(output) as { volumes?: GeneratedVolume[] } | GeneratedVolume[];
  const volumes = Array.isArray(data) ? data : data.volumes;
  if (!Array.isArray(volumes) || volumes.length === 0) {
    throw new Error("AI 输出缺少 volumes 数组");
  }
  return volumes.map((item, index) => ({
    title: String(item.title || `第 ${index + 1} 卷`),
    summary: String(item.summary || ""),
    startChapterNumber: normalizePositiveInt(item.startChapterNumber, index * 50 + 1),
    endChapterNumber: normalizePositiveInt(item.endChapterNumber, (index + 1) * 50),
    mainGoal: String(item.mainGoal || ""),
    mainConflict: String(item.mainConflict || ""),
    mainEnemy: item.mainEnemy ? String(item.mainEnemy) : undefined,
    keyCharacters: item.keyCharacters ? String(item.keyCharacters) : undefined,
    keySettings: item.keySettings ? String(item.keySettings) : undefined,
    foreshadowsToCreate: item.foreshadowsToCreate ? String(item.foreshadowsToCreate) : undefined,
    foreshadowsToResolve: item.foreshadowsToResolve ? String(item.foreshadowsToResolve) : undefined,
    climax: item.climax ? String(item.climax) : undefined,
  }));
}

function parseChapterOutlines(output: string): GeneratedChapter[] {
  const data = parseJsonPayload(output) as { chapters?: GeneratedChapter[] } | GeneratedChapter[];
  const chapters = Array.isArray(data) ? data : data.chapters;
  if (!Array.isArray(chapters) || chapters.length === 0) {
    throw new Error("AI 输出缺少 chapters 数组");
  }
  return chapters.map((item) => ({
    chapterNumber: normalizePositiveInt(item.chapterNumber, 1),
    title: String(item.title || `第 ${item.chapterNumber} 章`),
    outline: String(item.outline || ""),
  }));
}

function validateVolumeCoverage(volumes: GeneratedVolume[], targetChapters: number) {
  const sorted = [...volumes].sort((a, b) => a.startChapterNumber - b.startChapterNumber);
  let expectedStart = 1;
  for (const volume of sorted) {
    if (volume.startChapterNumber !== expectedStart) {
      throw new Error(`AI 分卷结果章节不连续：期望从第 ${expectedStart} 章开始，实际是第 ${volume.startChapterNumber} 章`);
    }
    if (volume.endChapterNumber < volume.startChapterNumber) {
      throw new Error(`AI 分卷结果章节范围无效：${volume.startChapterNumber}-${volume.endChapterNumber}`);
    }
    expectedStart = volume.endChapterNumber + 1;
  }
  if (expectedStart !== targetChapters + 1) {
    throw new Error(`AI 分卷结果未覆盖到目标章节：期望到第 ${targetChapters} 章，实际到第 ${expectedStart - 1} 章`);
  }
}

async function findCharacterForMemoryUpdate(novelId: string, name: string) {
  return prisma.character.findFirst({
    where: {
      novelId,
      OR: [
        { name },
        { alias: name },
        { alias: { contains: name } },
      ],
    },
  });
}

function validateChapterCoverage(chapters: GeneratedChapter[], startChapterNumber: number, endChapterNumber: number) {
  const numbers = new Set<number>();
  for (const chapter of chapters) {
    if (chapter.chapterNumber < startChapterNumber || chapter.chapterNumber > endChapterNumber) {
      throw new Error(`AI 章节细纲包含越界章节：第 ${chapter.chapterNumber} 章`);
    }
    if (numbers.has(chapter.chapterNumber)) {
      throw new Error(`AI 章节细纲包含重复章节：第 ${chapter.chapterNumber} 章`);
    }
    if (!chapter.outline.trim()) {
      throw new Error(`AI 章节细纲缺少正文：第 ${chapter.chapterNumber} 章`);
    }
    numbers.add(chapter.chapterNumber);
  }
  for (let number = startChapterNumber; number <= endChapterNumber; number += 1) {
    if (!numbers.has(number)) {
      throw new Error(`AI 章节细纲缺少第 ${number} 章`);
    }
  }
}

function parseJsonPayload(output: string): unknown {
  const cleaned = output
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}
