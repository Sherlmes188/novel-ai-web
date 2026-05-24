import Link from "next/link";
import { AppShell, Stat } from "@/components/app-shell";
import { aiAction, deleteNovelAction, updateNovelAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { SubmitButton } from "@/components/submit-button";

export default async function NovelDashboardPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: {
      chapters: true,
      aiTasks: { orderBy: { createdAt: "desc" }, take: 5 },
      settings: true,
      characters: true,
      volumes: true,
    },
  });
  const finalized = novel.chapters.filter((item) => item.contentStatus === "FINALIZED").length;
  const pendingReview = novel.chapters.filter((item) => item.contentStatus === "PENDING_REVIEW" || item.contentStatus === "NEED_REVISION").length;
  const globalOutline = novel.settings.find((item) => item.type === "global_outline");

  return (
    <AppShell title={novel.title} novelId={novel.id}>
      <div className="grid gap-3 md:grid-cols-4">
        <Stat label="当前字数" value={novel.currentWords} />
        <Stat label="章节数" value={novel.chapters.length} />
        <Stat label="已定稿" value={finalized} />
        <Stat label="待审稿" value={pendingReview} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="panel p-5">
          <h2 className="text-lg font-black">基础设定</h2>
          <form action={updateNovelAction} className="mt-4 grid gap-4">
            <input type="hidden" name="novelId" value={novel.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <label className="field"><span className="label">书名</span><input className="input" name="title" defaultValue={novel.title} /></label>
              <label className="field"><span className="label">类型</span><input className="input" name="type" defaultValue={novel.type} /></label>
              <label className="field"><span className="label">子类型</span><input className="input" name="subtype" defaultValue={novel.subtype || ""} /></label>
              <label className="field"><span className="label">卖点</span><input className="input" name="sellingPoint" defaultValue={novel.sellingPoint || ""} /></label>
              <label className="field"><span className="label">目标章节</span><input className="input" name="targetChapters" type="number" defaultValue={novel.targetChapters || ""} /></label>
              <label className="field"><span className="label">每章字数</span><input className="input" name="targetWordsPerChapter" type="number" defaultValue={novel.targetWordsPerChapter || ""} /></label>
            </div>
            <label className="field"><span className="label">简介</span><textarea className="textarea" name="summary" defaultValue={novel.summary || ""} /></label>
            <label className="field"><span className="label">写作风格</span><textarea className="textarea" name="stylePreference" defaultValue={novel.stylePreference || ""} /></label>
            <label className="field"><span className="label">主线目标</span><textarea className="textarea" name="mainGoal" defaultValue={novel.mainGoal || ""} /></label>
            <label className="field"><span className="label">结局目标</span><textarea className="textarea" name="finalGoal" defaultValue={novel.finalGoal || ""} /></label>
            <label className="field"><span className="label">禁忌事项</span><textarea className="textarea" name="forbiddenRules" defaultValue={novel.forbiddenRules || ""} /></label>
            <div className="flex flex-wrap gap-2">
              <button className="btn" type="submit">保存设定</button>
              <Link className="btn secondary" href={`/novels/${novel.id}/chapters`}>进入章节</Link>
            </div>
          </form>
        </section>

        <aside className="grid content-start gap-5">
          <section className="panel p-5">
            <h2 className="font-black">下一步建议</h2>
            <p className="muted mt-2 text-sm leading-6">
              {!globalOutline ? "还没有总大纲，建议先让 AI 生成总大纲。" : novel.volumes.length === 0 ? "已有总大纲，下一步补充分卷。" : novel.chapters.length === 0 ? "已有分卷，下一步创建章节细纲。" : pendingReview > 0 ? "有章节待审稿，建议先处理审稿建议。" : "可以继续生成下一章正文。"}
            </p>
            <form action={aiAction} className="mt-4 grid gap-3">
              <input type="hidden" name="novelId" value={novel.id} />
              <input type="hidden" name="targetType" value="novel" />
              <input type="hidden" name="taskType" value="global_outline" />
              <textarea className="textarea" name="instruction" placeholder="可补充大纲偏好" />
              <SubmitButton pendingText="AI 正在生成总大纲...">AI 生成总大纲</SubmitButton>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="font-black">最近 AI 任务</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {novel.aiTasks.map((task) => (
                <Link key={task.id} href={`/novels/${novel.id}/ai-tasks`} className="rounded-lg border border-[#ded8ca] p-3">
                  <b>{task.taskType}</b>
                  <div className="muted">{task.status}</div>
                </Link>
              ))}
              {novel.aiTasks.length === 0 ? <p className="muted">暂无任务。</p> : null}
            </div>
          </section>

          <form action={deleteNovelAction} className="panel p-5">
            <input type="hidden" name="novelId" value={novel.id} />
            <button className="btn danger w-full" type="submit">删除小说</button>
          </form>
        </aside>
      </div>
    </AppShell>
  );
}
