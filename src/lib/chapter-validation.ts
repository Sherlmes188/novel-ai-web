import { wordCount } from "@/lib/utils";

export type ChapterValidationResult = {
  passed: boolean;
  warnings: string[];
  blockingIssues: string[];
};

type ValidationNovel = {
  targetWordsPerChapter?: number | null;
  forbiddenRules?: string | null;
  forbiddenTerms?: { term: string; severity: number; category?: string | null }[];
};

type ValidationChapter = {
  title?: string | null;
  outline?: string | null;
};

export function validateGeneratedChapter(
  content: string,
  novel: ValidationNovel,
  chapter: ValidationChapter,
): ChapterValidationResult {
  const warnings: string[] = [];
  const blockingIssues: string[] = [];
  const trimmed = content.trim();
  const count = wordCount(trimmed);
  const targetWords = novel.targetWordsPerChapter || 0;

  if (!trimmed) {
    blockingIssues.push("正文为空。");
  }

  if (targetWords > 0 && count < Math.floor(targetWords * 0.7)) {
    warnings.push(`正文约 ${count} 字，低于目标字数 ${targetWords} 的 70%。`);
  }

  if (/^#{1,6}\s+/m.test(trimmed) || /\*\*.+\*\*/.test(trimmed.slice(0, 500))) {
    warnings.push("正文中疑似包含 Markdown 标题或强调格式。");
  }

  if (/^(以下是|下面是|本章内容如下|正文如下|第[一二三四五六七八九十\d]+章[:：])/i.test(trimmed)) {
    warnings.push("正文开头疑似包含解释性引导语或重复章节标题。");
  }

  const longParagraphs = trimmed
    .split(/\n+/)
    .map((item) => item.trim())
    .filter((item) => wordCount(item) > 900);
  if (longParagraphs.length) {
    warnings.push(`存在 ${longParagraphs.length} 个超过 900 字的超长段落，建议拆分。`);
  }

  const bannedHits = (novel.forbiddenTerms || [])
    .filter((item) => item.term && trimmed.includes(item.term))
    .slice(0, 12)
    .map((item) => `${item.term}（严重度 ${item.severity}）`);
  if (bannedHits.length) {
    warnings.push(`命中禁用词/烂梗：${bannedHits.join("、")}。`);
  }

  if (novel.forbiddenRules) {
    const ruleHits = novel.forbiddenRules
      .split(/[，,、\n；;]/)
      .map((item) => item.trim())
      .filter((item) => item.length >= 2 && item.length <= 20 && trimmed.includes(item))
      .slice(0, 8);
    if (ruleHits.length) {
      warnings.push(`疑似命中禁忌写法：${ruleHits.join("、")}。`);
    }
  }

  const dialogueMarks = (trimmed.match(/[“”]/g) || []).length;
  if (count > 1200 && dialogueMarks < 2) {
    warnings.push("正文中中文对话引号较少，可能缺少对话或格式不规范。");
  }

  if (chapter.outline && trimmed.length > 0 && wordCount(chapter.outline) > 80) {
    const outlineKeywords = extractKeywords(chapter.outline);
    const matched = outlineKeywords.filter((keyword) => trimmed.includes(keyword));
    if (outlineKeywords.length >= 5 && matched.length < Math.ceil(outlineKeywords.length * 0.25)) {
      warnings.push("正文与章节细纲关键词重合较少，建议人工确认是否偏离细纲。");
    }
  }

  return {
    passed: blockingIssues.length === 0,
    warnings,
    blockingIssues,
  };
}

export function formatChapterValidationResult(result: ChapterValidationResult) {
  const lines = [
    "【正文生成后校验】",
    `结果：${result.passed ? "通过基础校验" : "存在阻断问题"}`,
  ];
  if (result.blockingIssues.length) {
    lines.push("", "阻断问题：", ...result.blockingIssues.map((item) => `- ${item}`));
  }
  if (result.warnings.length) {
    lines.push("", "风险提醒：", ...result.warnings.map((item) => `- ${item}`));
  }
  if (!result.blockingIssues.length && !result.warnings.length) {
    lines.push("", "未发现明显格式风险。");
  }
  return lines.join("\n");
}

function extractKeywords(text: string) {
  return Array.from(
    new Set(
      text
        .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, " ")
        .split(/\s+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2 && item.length <= 8)
        .filter((item) => !/^(本章|主角|人物|场景|冲突|爽点|伏笔|结尾|目标|推进)$/.test(item))
        .slice(0, 24),
    ),
  );
}
