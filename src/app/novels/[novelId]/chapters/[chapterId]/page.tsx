import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { aiAction, finalizeChapterAction, schedulePublicationAction, updateChapterAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { prisma } from "@/lib/db";
import { SubmitButton } from "@/components/submit-button";

const publishStatusLabel: Record<string, string> = {
  PENDING: "待发布",
  RUNNING: "发布中",
  NEEDS_LOGIN: "需人工登录",
  FAILED: "失败",
  PUBLISHED: "已发布",
  CANCELED: "已取消",
};

function datetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export default async function ChapterPage({ params }: { params: Promise<{ novelId: string; chapterId: string }> }) {
  const { novelId, chapterId } = await params;
  const novel = await requireOwnedNovel(novelId);
  const chapter = await prisma.chapter.findFirstOrThrow({
    where: { id: chapterId, novelId },
    include: { publicationJobs: { where: { platform: "fanqie" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const versions = await prisma.version.findMany({
    where: { targetId: chapterId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const publishJob = chapter.publicationJobs[0];
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 1);
  nextRun.setHours(8, 0, 0, 0);

  return (
    <AppShell title={`第 ${chapter.chapterNumber} 章 / ${chapter.title}`} novelId={novel.id}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link className="btn secondary" href={`/novels/${novel.id}/chapters`}>返回章节列表</Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <form action={updateChapterAction} className="panel grid gap-4 p-5">
          <input type="hidden" name="novelId" value={novel.id} />
          <input type="hidden" name="chapterId" value={chapter.id} />
          <div className="grid gap-4 md:grid-cols-[120px_1fr_180px_180px]">
            <label className="field"><span className="label">章号</span><input className="input" value={chapter.chapterNumber} readOnly /></label>
            <label className="field"><span className="label">标题</span><input className="input" name="title" defaultValue={chapter.title} /></label>
            <label className="field"><span className="label">细纲状态</span><select className="select" name="outlineStatus" defaultValue={chapter.outlineStatus}>
              {["NOT_STARTED", "GENERATED", "PENDING_CONFIRM", "CONFIRMED", "NEED_REVISION"].map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label className="field"><span className="label">正文状态</span><select className="select" name="contentStatus" defaultValue={chapter.contentStatus}>
              {["NOT_STARTED", "DRAFT", "PENDING_REVIEW", "NEED_REVISION", "POLISHED", "FINALIZED", "EXPORTED"].map((item) => <option key={item}>{item}</option>)}
            </select></label>
          </div>
          <label className="field"><span className="label">章节细纲</span><textarea className="textarea" name="outline" defaultValue={chapter.outline || ""} /></label>
          <label className="field"><span className="label">正文</span><textarea className="textarea min-h-[560px]" name="content" defaultValue={chapter.content || ""} /></label>
          <label className="field"><span className="label">章节摘要</span><textarea className="textarea" name="summary" defaultValue={chapter.summary || ""} /></label>
          <div className="flex flex-wrap gap-2">
            <button className="btn" type="submit">保存章节</button>
          </div>
        </form>

        <aside className="grid content-start gap-5">
          <section className="panel p-5">
            <h2 className="font-black">AI 操作</h2>
            <div className="mt-3 grid gap-3">
              {[
                ["chapter_outline", "生成章节细纲"],
                ["chapter_content", "根据细纲生成正文"],
                ["review_chapter", "审稿并给建议"],
              ].map(([taskType, label]) => (
                <form key={taskType} action={aiAction} className="grid gap-2">
                  <input type="hidden" name="novelId" value={novel.id} />
                  <input type="hidden" name="targetType" value="chapter" />
                  <input type="hidden" name="targetId" value={chapter.id} />
                  <input type="hidden" name="taskType" value={taskType} />
                  <textarea className="textarea" name="instruction" placeholder="补充要求，可留空" />
                  <SubmitButton className="btn secondary" pendingText="AI 正在生成...">{label}</SubmitButton>
                </form>
              ))}
            </div>
          </section>

          {chapter.aiReviewStatus ? (
            <section className="panel p-5">
              <h2 className="font-black">最近审稿结果</h2>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6">{chapter.aiReviewStatus}</pre>
            </section>
          ) : null}

          <form action={finalizeChapterAction} className="panel p-5">
            <input type="hidden" name="novelId" value={novel.id} />
            <input type="hidden" name="chapterId" value={chapter.id} />
            <button className="btn w-full" type="submit">标记为定稿</button>
          </form>

          <section className="panel p-5">
            <h2 className="font-black">发布到番茄</h2>
            {publishJob ? (
              <p className="muted mt-2 text-sm leading-6">
                当前状态：{publishStatusLabel[publishJob.status] || publishJob.status}
                <br />
                计划时间：{publishJob.scheduledAt.toLocaleString("zh-CN", { hour12: false })}
              </p>
            ) : null}
            {chapter.contentStatus === "FINALIZED" && chapter.content?.trim() ? (
              <form action={schedulePublicationAction} className="mt-4 grid gap-3">
                <input type="hidden" name="novelId" value={novel.id} />
                <input type="hidden" name="chapterId" value={chapter.id} />
                <label className="field">
                  <span className="label">计划发布时间</span>
                  <input className="input" name="scheduledAt" type="datetime-local" defaultValue={datetimeLocal(nextRun)} required />
                </label>
                <button className="btn w-full" type="submit">{publishJob ? "更新发布计划" : "加入发布队列"}</button>
                <Link className="btn secondary w-full" href={`/novels/${novel.id}/publications`}>查看发布队列</Link>
              </form>
            ) : (
              <p className="muted mt-2 text-sm leading-6">章节定稿且正文不为空后，可以加入发布队列。</p>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="font-black">版本历史</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {versions.map((version) => (
                <details key={version.id} className="rounded-lg border border-[#ded8ca] p-3">
                  <summary className="cursor-pointer font-bold">v{version.versionNumber} {version.changeSummary}</summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5">{version.content}</pre>
                </details>
              ))}
              {versions.length === 0 ? <p className="muted">暂无历史。</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
