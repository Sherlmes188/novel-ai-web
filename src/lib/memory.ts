import { prisma } from "@/lib/db";
import { cosineSimilarity, embedText, embedTexts, embeddingEnabled } from "@/lib/embedding";
import { wordCount } from "@/lib/utils";

type MemoryInput = {
  novelId: string;
  sourceType: string;
  sourceId?: string | null;
  chapterNumber?: number | null;
  title?: string | null;
  content: string;
  importance?: number;
};

export async function rebuildNovelMemory(novelId: string) {
  await prisma.memoryChunk.deleteMany({ where: { novelId } });
  const [chapters, characters, worldSettings, foreshadows, timeline] = await Promise.all([
    prisma.chapter.findMany({ where: { novelId }, orderBy: { chapterNumber: "asc" } }),
    prisma.character.findMany({ where: { novelId }, orderBy: { updatedAt: "desc" } }),
    prisma.worldSetting.findMany({ where: { novelId }, orderBy: [{ importance: "desc" }, { updatedAt: "desc" }] }),
    prisma.foreshadow.findMany({ where: { novelId }, orderBy: [{ importance: "desc" }, { updatedAt: "desc" }] }),
    prisma.timelineEvent.findMany({ where: { novelId }, orderBy: [{ chapterNumber: "asc" }, { createdAt: "asc" }] }),
  ]);
  const inputs: MemoryInput[] = [];
  for (const chapter of chapters) {
    inputs.push(...buildChapterMemoryInputs(novelId, chapter));
  }
  for (const character of characters) {
    const content = [
      `人物：${character.name}`,
      character.identity ? `身份：${character.identity}` : "",
      character.faction ? `势力：${character.faction}` : "",
      character.personality ? `性格：${character.personality}` : "",
      character.relationshipWithProtagonist ? `关系：${character.relationshipWithProtagonist}` : "",
      character.cultivationLevel ? `能力/境界：${character.cultivationLevel}` : "",
      character.items ? `物品：${character.items}` : "",
      character.goal ? `目标：${character.goal}` : "",
      character.currentStatus ? `当前状态：${character.currentStatus}` : "",
      character.notes ? `备注：${character.notes}` : "",
    ].filter(Boolean).join("\n");
    inputs.push({ novelId, sourceType: "character", sourceId: character.id, title: character.name, content, importance: 5 });
  }
  for (const setting of worldSettings) {
    inputs.push({
      novelId,
      sourceType: "world",
      sourceId: setting.id,
      title: setting.title,
      content: `世界观/${setting.category}/${setting.title}\n${setting.content}`,
      importance: setting.importance,
    });
  }
  for (const foreshadow of foreshadows) {
    inputs.push({
      novelId,
      sourceType: "foreshadow",
      sourceId: foreshadow.id,
      chapterNumber: foreshadow.plantedChapterNumber || foreshadow.expectedResolveChapterNumber || null,
      title: foreshadow.title,
      content: [
        `伏笔：${foreshadow.title}`,
        `状态：${foreshadow.status}`,
        foreshadow.content,
        foreshadow.resolvePlan ? `回收计划：${foreshadow.resolvePlan}` : "",
        foreshadow.notes ? `备注：${foreshadow.notes}` : "",
      ].filter(Boolean).join("\n"),
      importance: foreshadow.importance,
    });
  }
  for (const event of timeline) {
    inputs.push({
      novelId,
      sourceType: "timeline",
      sourceId: event.id,
      chapterNumber: event.chapterNumber,
      title: event.title,
      content: [
        `时间线事件：${event.title}`,
        event.chapterNumber ? `章节：第${event.chapterNumber}章` : "",
        event.content,
        event.impactOnPlot ? `影响：${event.impactOnPlot}` : "",
      ].filter(Boolean).join("\n"),
      importance: event.isKeyEvent ? 5 : 3,
    });
  }
  await createMemoryChunks(inputs);
  return inputs.length;
}

export async function indexChapterMemory(novelId: string, chapterId: string) {
  const chapter = await prisma.chapter.findFirstOrThrow({ where: { id: chapterId, novelId } });
  await prisma.memoryChunk.deleteMany({
    where: { novelId, sourceId: chapterId, sourceType: { in: ["chapter_summary", "chapter_content"] } },
  });
  const inputs = buildChapterMemoryInputs(novelId, chapter);
  await createMemoryChunks(inputs);
  return inputs.length;
}

export async function searchNovelMemory(novelId: string, query: string, options: { topK?: number; beforeChapterNumber?: number | null } = {}) {
  const topK = options.topK || 8;
  const chunks = await prisma.memoryChunk.findMany({
    where: {
      novelId,
      chapterNumber: options.beforeChapterNumber ? { lt: options.beforeChapterNumber } : undefined,
    },
    orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
    take: 300,
  });
  const queryVector = embeddingEnabled() ? await embedText(query) : [];
  const queryTokens = tokenize(query);
  return chunks
    .map((chunk) => {
      const vector = Array.isArray(chunk.embedding) ? chunk.embedding.filter((item): item is number => typeof item === "number") : [];
      const vectorScore = queryVector.length ? cosineSimilarity(queryVector, vector) : 0;
      const keywordScore = keywordSimilarity(queryTokens, chunk.content + " " + (chunk.title || ""));
      return { ...chunk, score: vectorScore || keywordScore };
    })
    .filter((chunk) => chunk.score > 0)
    .sort((a, b) => b.score - a.score || b.importance - a.importance)
    .slice(0, topK);
}

export function formatMemoryForPrompt(chunks: { sourceType: string; chapterNumber: number | null; title: string | null; content: string; score?: number }[]) {
  if (!chunks.length) return "";
  return `\n\n【远期记忆检索结果】\n${chunks.map((chunk, index) => {
    const source = [
      chunk.sourceType,
      chunk.chapterNumber ? `第${chunk.chapterNumber}章` : "",
      chunk.title || "",
    ].filter(Boolean).join(" / ");
    return `${index + 1}. 来源：${source}\n内容：${chunk.content.slice(0, 800)}`;
  }).join("\n\n")}`;
}

function buildChapterMemoryInputs(novelId: string, chapter: { id: string; chapterNumber: number; title: string; summary: string | null; content: string | null }) {
  const inputs: MemoryInput[] = [];
  if (chapter.summary?.trim()) {
    inputs.push({
      novelId,
      sourceType: "chapter_summary",
      sourceId: chapter.id,
      chapterNumber: chapter.chapterNumber,
      title: chapter.title,
      content: `第${chapter.chapterNumber}章《${chapter.title}》摘要：\n${chapter.summary}`,
      importance: 4,
    });
  }
  if (chapter.content?.trim()) {
    splitChineseText(chapter.content).forEach((content, index) => {
      inputs.push({
        novelId,
        sourceType: "chapter_content",
        sourceId: chapter.id,
        chapterNumber: chapter.chapterNumber,
        title: `${chapter.title} / 片段 ${index + 1}`,
        content: `第${chapter.chapterNumber}章《${chapter.title}》正文片段 ${index + 1}：\n${content}`,
        importance: 2,
      });
    });
  }
  return inputs;
}

async function createMemoryChunks(inputs: MemoryInput[]) {
  const cleanInputs = inputs.filter((input) => input.content.trim());
  const embeddings = embeddingEnabled() ? await embedTexts(cleanInputs.map((input) => input.content)) : cleanInputs.map(() => []);
  for (const [index, input] of cleanInputs.entries()) {
    await prisma.memoryChunk.create({
      data: {
        novelId: input.novelId,
        sourceType: input.sourceType,
        sourceId: input.sourceId || null,
        chapterNumber: input.chapterNumber || null,
        title: input.title || null,
        content: input.content.slice(0, 5000),
        tokenEstimate: Math.ceil(wordCount(input.content) / 1.5),
        importance: input.importance || 3,
        embedding: embeddings[index].length ? embeddings[index] : undefined,
      },
    });
  }
}

function splitChineseText(text: string) {
  const normalized = text.replace(/\r/g, "").trim();
  const chunks: string[] = [];
  const size = 1100;
  const overlap = 120;
  for (let start = 0; start < normalized.length; start += size - overlap) {
    const chunk = normalized.slice(start, start + size).trim();
    if (chunk) chunks.push(chunk);
  }
  return chunks.slice(0, 80);
}

function tokenize(text: string) {
  return Array.from(new Set(text.replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, " ").split(/\s+/).filter((item) => item.length >= 2)));
}

function keywordSimilarity(queryTokens: string[], text: string) {
  if (!queryTokens.length) return 0;
  const hit = queryTokens.filter((token) => text.includes(token)).length;
  return hit / queryTokens.length;
}
