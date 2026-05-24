import { cancelPublicationAction, createPublicationQueueAction, markChapterPublishedAction, schedulePublicationAction, updateFanqieSettingsAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { AppShell } from "@/components/app-shell";

const statusLabel: Record<string, string> = {
  PENDING: "待发布",
  RUNNING: "发布中",
  NEEDS_LOGIN: "需人工登录",
  FAILED: "失败",
  PUBLISHED: "已发布",
  CANCELED: "已取消",
};

function datetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function PublicationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ novelId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { novelId } = await params;
  const { error } = await searchParams;
  const novel = await requireOwnedNovel(novelId, {
    include: {
      chapters: {
        where: { contentStatus: "FINALIZED", content: { not: null } },
        orderBy: { chapterNumber: "asc" },
        include: { publicationJobs: { where: { platform: "fanqie" } } },
      },
      publicationJobs: {
        where: { platform: "fanqie" },
        orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
        include: { chapter: true },
      },
    },
  });
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 1);
  nextRun.setHours(8, 0, 0, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startDate = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`;
  const latestQueuedOrPublished = novel.publicationJobs
    .filter((job) => ["PENDING", "RUNNING", "PUBLISHED"].includes(job.status))
    .reduce((max, job) => Math.max(max, job.chapter.chapterNumber), 0);
  const defaultStartChapterNumber = latestQueuedOrPublished + 1;

  return (
    <AppShell title={`${novel.title} / 发布`} novelId={novel.id}>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="grid content-start gap-5">
          <section className="panel p-5">
            <h2 className="font-black">番茄作品绑定</h2>
            <p className="muted mt-2 text-sm leading-6">新小说要发布到番茄时，先在这里填该作品的章节管理页和新建章节页。</p>
            <form action={updateFanqieSettingsAction} className="mt-4 grid gap-3">
              <input type="hidden" name="novelId" value={novel.id} />
              <label className="field">
                <span className="label">章节管理页 URL</span>
                <input className="input" name="fanqieWorkspaceUrl" defaultValue={novel.fanqieWorkspaceUrl || ""} placeholder="https://fanqienovel.com/main/writer/chapter-manage/..." />
              </label>
              <label className="field">
                <span className="label">新建章节页 URL</span>
                <input className="input" name="fanqiePublishUrl" defaultValue={novel.fanqiePublishUrl || ""} placeholder="https://fanqienovel.com/main/writer/{bookId}/publish/?enter_from=newchapter" />
              </label>
              <button className="btn secondary" type="submit">保存番茄配置</button>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="font-black">番茄定时发布</h2>
            <p className="muted mt-2 text-sm leading-6">只允许选择已定稿且有正文的章节。脚本会复用人工登录态，遇到登录失效或验证码会停下并记录错误。</p>
            {error ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error === "chapter" ? "请选择已定稿且有正文的章节。" : "排期参数不完整。"}
              </p>
            ) : null}
            <form action={schedulePublicationAction} className="mt-4 grid gap-4">
              <input type="hidden" name="novelId" value={novel.id} />
              <label className="field">
                <span className="label">章节</span>
                <select className="select" name="chapterId" required defaultValue="">
                  <option value="" disabled>选择要发布的章节</option>
                  {novel.chapters.map((chapter) => {
                    const job = chapter.publicationJobs[0];
                    const suffix = job ? ` / ${statusLabel[job.status] || job.status}` : "";
                    return (
                      <option key={chapter.id} value={chapter.id}>
                        第 {chapter.chapterNumber} 章 {chapter.title}{suffix}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="field">
                <span className="label">计划发布时间</span>
                <input className="input" name="scheduledAt" type="datetime-local" defaultValue={datetimeLocal(nextRun)} required />
              </label>
              <button className="btn" type="submit">加入发布队列</button>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="font-black">一键生成发布队列</h2>
            <p className="muted mt-2 text-sm leading-6">把所有有正文但未发布、未入队的章节按章号排队。按每日字数上限自动分天，随机排在 12:00-15:00 之间，间隔不少于 3 分钟。</p>
            <form action={createPublicationQueueAction} className="mt-4 grid gap-3">
              <input type="hidden" name="novelId" value={novel.id} />
              <label className="field">
                <span className="label">从第几章开始</span>
                <input className="input" name="startChapterNumber" type="number" min={1} defaultValue={defaultStartChapterNumber || 1} />
              </label>
              <label className="field">
                <span className="label">每日发布字数上限</span>
                <input className="input" name="maxDailyWords" type="number" min={1000} step={500} defaultValue={10000} />
              </label>
              <label className="field">
                <span className="label">开始日期</span>
                <input className="input" name="startDate" type="date" defaultValue={startDate} />
              </label>
              <button className="btn" type="submit">一键提交未发布章节</button>
            </form>
          </section>

          <section className="panel p-5">
            <h2 className="font-black">手动标记已发布</h2>
            <p className="muted mt-2 text-sm leading-6">用于补录已经在番茄发布的章节，避免脚本再次排队。</p>
            <form action={markChapterPublishedAction} className="mt-4 grid gap-3">
              <input type="hidden" name="novelId" value={novel.id} />
              <label className="field">
                <span className="label">章节</span>
                <select className="select" name="chapterId" required defaultValue="">
                  <option value="" disabled>选择章节</option>
                  {novel.chapters.map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>第 {chapter.chapterNumber} 章 {chapter.title}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="label">已发布时间</span>
                <input className="input" name="publishedAt" type="datetime-local" defaultValue={datetimeLocal(new Date())} />
              </label>
              <button className="btn secondary" type="submit">标记为已发布</button>
            </form>
          </section>
        </div>

        <section className="panel overflow-hidden">
          <div className="grid grid-cols-[110px_1fr_170px_110px_110px] gap-3 border-b border-[#ded8ca] px-4 py-3 text-sm font-black max-md:hidden">
            <span>状态</span><span>章节</span><span>计划时间</span><span>尝试</span><span>操作</span>
          </div>
          {novel.publicationJobs.map((job) => (
            <div key={job.id} className="grid gap-2 border-b border-[#eee7d8] px-4 py-3 md:grid-cols-[110px_1fr_170px_110px_110px]">
              <span className="chip w-fit">{statusLabel[job.status] || job.status}</span>
              <span>
                第 {job.chapter.chapterNumber} 章 {job.chapter.title}
                {job.lastError ? <span className="mt-1 block text-xs text-red-700">{job.lastError}</span> : null}
              </span>
              <span>{job.scheduledAt.toLocaleString("zh-CN", { hour12: false })}</span>
              <span>{job.attempts}</span>
              <span>
                {["PENDING", "FAILED", "NEEDS_LOGIN"].includes(job.status) ? (
                  <form action={cancelPublicationAction}>
                    <input type="hidden" name="novelId" value={novel.id} />
                    <input type="hidden" name="jobId" value={job.id} />
                    <button className="btn secondary" type="submit">取消</button>
                  </form>
                ) : null}
              </span>
            </div>
          ))}
          {novel.publicationJobs.length === 0 ? <p className="muted p-5">暂无发布任务。</p> : null}
        </section>
      </div>
    </AppShell>
  );
}
