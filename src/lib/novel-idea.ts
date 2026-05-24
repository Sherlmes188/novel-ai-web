export type NovelIdeaCharacter = {
  name?: string;
  identity?: string;
  faction?: string;
  relationshipWithProtagonist?: string;
  personality?: string;
  goal?: string;
  currentStatus?: string;
  notes?: string;
};

export type NovelIdea = {
  title: string;
  type: string;
  subtype?: string;
  sellingPoint?: string;
  summary?: string;
  targetChapters?: number | null;
  targetWordsPerChapter?: number | null;
  stylePreference?: string;
  forbiddenRules?: string;
  mainGoal?: string;
  finalGoal?: string;
  globalOutline?: string;
  protagonist?: string | NovelIdeaCharacter;
  mainCharacters?: string | NovelIdeaCharacter[];
  worldSetting?: string;
};

export function parseNovelIdea(output: string): Required<Pick<NovelIdea, "title" | "type">> & NovelIdea {
  const cleaned = output
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const value = JSON.parse(cleaned) as NovelIdea;
  if (!value.title || !value.type) {
    throw new Error("AI 输出缺少书名或类型");
  }
  return {
    ...value,
    title: String(value.title).slice(0, 80),
    type: String(value.type).slice(0, 40),
    protagonist: formatIdeaCharacter(value.protagonist),
    targetChapters: normalizePositiveInt(value.targetChapters, 100),
    targetWordsPerChapter: normalizePositiveInt(value.targetWordsPerChapter, 2500),
  };
}

export function formatIdeaCharacter(value: unknown) {
  if (!value || typeof value !== "object") {
    return typeof value === "string" ? value : "";
  }
  const data = value as NovelIdeaCharacter;
  return [
    data.name ? `姓名：${data.name}` : "",
    data.identity ? `身份：${data.identity}` : "",
    data.faction ? `势力：${data.faction}` : "",
    data.relationshipWithProtagonist ? `与主角关系：${data.relationshipWithProtagonist}` : "",
    data.personality ? `性格：${data.personality}` : "",
    data.goal ? `目标：${data.goal}` : "",
    data.currentStatus ? `当前状态：${data.currentStatus}` : "",
    data.notes ? `备注：${data.notes}` : "",
  ].filter(Boolean).join("；");
}

function normalizePositiveInt(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : fallback;
}
