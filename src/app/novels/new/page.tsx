import { AppShell } from "@/components/app-shell";
import { createNovelAction, generateNovelIdeaAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatIdeaCharacter, parseNovelIdea, type NovelIdea } from "@/lib/novel-idea";
import { SubmitButton } from "@/components/submit-button";

export default async function NewNovelPage({
  searchParams,
}: {
  searchParams: Promise<{ aiError?: string; draftTask?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  let draft: NovelIdea | null = null;
  if (params.draftTask) {
    const task = await prisma.aiTask.findUnique({ where: { id: params.draftTask } });
    if (task?.outputContent) {
      try {
        draft = parseNovelIdea(task.outputContent);
      } catch {
        draft = null;
      }
    }
  }

  return (
    <AppShell title="创建小说">
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={generateNovelIdeaAction} className="panel grid content-start gap-4 p-5">
          <div>
            <h2 className="text-lg font-black">AI 一键生成方案</h2>
            <p className="muted mt-1 text-sm leading-6">输入一个简单想法，AI 会生成书名、类型、卖点、简介、主线和总大纲，并回填到右侧表单。你可以继续修改后再创建。</p>
          </div>
          {params.aiError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              AI 生成失败，请检查 DeepSeek Key 或稍后重试。
            </div>
          ) : null}
          {draft ? (
            <div className="rounded-lg border border-[#b8d6cf] bg-[#edf8f5] p-3 text-sm text-[#1f5f57]">
              已生成方案并回填到右侧，确认后点击创建。
            </div>
          ) : null}
          <label className="field">
            <span className="label">简单描述</span>
            <textarea
              className="textarea min-h-52"
              name="description"
              placeholder="例：废柴少年得到一枚古老戒指，宗门被灭后一路升级复仇，风格热血爽文，主角不圣母。"
              required
            />
          </label>
          <SubmitButton pendingText="AI 正在生成...">AI 生成方案</SubmitButton>
        </form>

        <form action={createNovelAction} className="panel grid gap-4 p-5">
          <div>
            <h2 className="text-lg font-black">手动创建</h2>
            <p className="muted mt-1 text-sm">也可以先手动录入基础信息，后续再在工作台里生成总大纲。</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field"><span className="label">书名</span><input className="input" name="title" required defaultValue={draft?.title || ""} /></label>
            <label className="field"><span className="label">类型</span><input className="input" name="type" placeholder="玄幻 / 都市 / 科幻" defaultValue={draft?.type || ""} /></label>
            <label className="field"><span className="label">子类型</span><input className="input" name="subtype" placeholder="升级流 / 系统流" defaultValue={draft?.subtype || ""} /></label>
            <label className="field"><span className="label">一句话卖点</span><input className="input" name="sellingPoint" defaultValue={draft?.sellingPoint || ""} /></label>
            <label className="field"><span className="label">目标章节</span><input className="input" name="targetChapters" type="number" defaultValue={draft?.targetChapters || 100} /></label>
            <label className="field"><span className="label">每章目标字数</span><input className="input" name="targetWordsPerChapter" type="number" defaultValue={draft?.targetWordsPerChapter || 2500} /></label>
          </div>
          <label className="field"><span className="label">简介</span><textarea className="textarea" name="summary" defaultValue={draft?.summary || ""} /></label>
          <label className="field"><span className="label">写作风格</span><textarea className="textarea" name="stylePreference" placeholder="快节奏、强冲突、爽点明确..." defaultValue={draft?.stylePreference || ""} /></label>
          <label className="field"><span className="label">主线目标</span><textarea className="textarea" name="mainGoal" defaultValue={draft?.mainGoal || ""} /></label>
          <label className="field"><span className="label">结局目标</span><textarea className="textarea" name="finalGoal" defaultValue={draft?.finalGoal || ""} /></label>
          <label className="field"><span className="label">禁忌事项</span><textarea className="textarea" name="forbiddenRules" defaultValue={draft?.forbiddenRules || ""} /></label>
          {draft ? (
            <>
              <label className="field"><span className="label">AI 总大纲</span><textarea className="textarea" name="globalOutline" defaultValue={draft.globalOutline || ""} /></label>
              <label className="field"><span className="label">AI 主角设定</span><textarea className="textarea" name="protagonist" defaultValue={formatIdeaCharacter(draft.protagonist)} /></label>
              <label className="field"><span className="label">AI 主要人物</span><textarea className="textarea" name="mainCharacters" defaultValue={formatDraftCharacters(draft.mainCharacters)} /></label>
              <label className="field"><span className="label">AI 世界观</span><textarea className="textarea" name="worldSetting" defaultValue={draft.worldSetting || ""} /></label>
            </>
          ) : null}
          <SubmitButton className="btn w-fit" pendingText="正在创建...">创建并进入工作台</SubmitButton>
        </form>
      </div>
    </AppShell>
  );
}

function formatDraftCharacters(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (!item || typeof item !== "object") return String(item);
      const data = item as Record<string, unknown>;
      return formatIdeaCharacter(data);
    }).join("\n");
  }
  return typeof value === "string" ? value : "";
}
