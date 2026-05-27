import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { autoGenerateLatestChaptersAction, batchFinalizeChaptersAction, createChapterAction, generateChapterOutlinesForVolumeAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { prisma } from "@/lib/db";

const pageSize = 25;

export default async function ChaptersPage({
  params,
  searchParams,
}: {
  params: Promise<{ novelId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { novelId } = await params;
  const { page: pageParam } = await searchParams;
  const currentPage = Math.max(Number(pageParam || 1) || 1, 1);
  await requireOwnedNovel(novelId, { select: { id: true } });
  const totalChapters = await prisma.chapter.count({ where: { novelId } });
  const totalPages = Math.max(Math.ceil(totalChapters / pageSize), 1);
  const safePage = Math.min(currentPage, totalPages);
  const novel = await requireOwnedNovel(novelId, {
    include: {
      volumes: { orderBy: { startChapterNumber: "asc" } },
      chapters: {
        orderBy: { chapterNumber: "asc" },
        skip: (safePage - 1) * pageSize,
        take: pageSize,
        include: {
          volume: true,
          publicationJobs: { where: { platform: "fanqie" }, orderBy: { createdAt: "desc" }, take: 1 },
        },
      },
    },
  });

  return (
    <AppShell title={`${novel.title} / 章节`} novelId={novel.id}>
      <form action={autoGenerateLatestChaptersAction} className="panel mb-5 grid gap-3 p-5 md:grid-cols-[180px_1fr_auto]">
        <input type="hidden" name="novelId" value={novel.id} />
        <label className="field">
          <span className="label">从最新正文后续写章数</span>
          <input className="input" name="chapterCount" type="number" min={1} max={20} defaultValue={1} />
        </label>
        <label className="field">
          <span className="label">补充要求</span>
          <input className="input" name="instruction" placeholder="例如：保持强冲突，每章结尾留悬念，避免旁白过多" />
        </label>
        <div className="flex items-end">
          <SubmitButton pendingText="AI 正在自动续写...">自动生成最新章节</SubmitButton>
        </div>
      </form>

      <form action={generateChapterOutlinesForVolumeAction} className="panel mb-5 grid gap-3 p-5 md:grid-cols-[220px_1fr_auto]">
        <input type="hidden" name="novelId" value={novel.id} />
        <select className="select" name="volumeId" required defaultValue="">
          <option value="" disabled>选择分卷生成章节细纲</option>
          {novel.volumes.map((volume) => (
            <option key={volume.id} value={volume.id}>
              {volume.title}（{volume.startChapterNumber}-{volume.endChapterNumber}章）
            </option>
          ))}
        </select>
        <input className="input" name="instruction" placeholder="可补充章节细纲偏好，例如每章结尾必须留钩子" />
        <SubmitButton pendingText="AI 正在生成章节细纲...">AI 按卷纲生成章节细纲</SubmitButton>
      </form>

      <form action={createChapterAction} className="panel mb-5 grid gap-3 p-5 md:grid-cols-[120px_1fr_180px_auto]">
        <input type="hidden" name="novelId" value={novel.id} />
        <input className="input" name="chapterNumber" type="number" placeholder="章号" />
        <input className="input" name="title" placeholder="章节标题" />
        <select className="select" name="volumeId" defaultValue="">
          <option value="">不关联分卷</option>
          {novel.volumes.map((volume) => <option key={volume.id} value={volume.id}>{volume.title}</option>)}
        </select>
        <button className="btn" type="submit">新增章节</button>
      </form>

      <form action={batchFinalizeChaptersAction} className="panel mb-5 grid gap-3 p-5 md:grid-cols-[130px_130px_180px_auto]">
        <input type="hidden" name="novelId" value={novel.id} />
        <label className="field">
          <span className="label">起始章号</span>
          <input className="input" name="startChapterNumber" type="number" min={1} placeholder="如 1" />
        </label>
        <label className="field">
          <span className="label">结束章号</span>
          <input className="input" name="endChapterNumber" type="number" min={1} placeholder="如 50" />
        </label>
        <label className="field">
          <span className="label">原正文状态</span>
          <select className="select" name="status" defaultValue="ANY">
            <option value="ANY">任意有正文章节</option>
            <option value="PENDING_REVIEW">PENDING_REVIEW</option>
            <option value="POLISHED">POLISHED</option>
            <option value="EXPORTED">EXPORTED</option>
          </select>
        </label>
        <div className="flex items-end">
          <button className="btn secondary" type="submit">批量标记定稿</button>
        </div>
      </form>

      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 px-4 py-3">
          <div className="text-sm font-semibold">
            共 {totalChapters} 章，每页 {pageSize} 章，当前第 {safePage} / {totalPages} 页
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="btn secondary" href={`/novels/${novel.id}/chapters?page=${Math.max(safePage - 1, 1)}`}>上一页</Link>
            <Link className="btn secondary" href={`/novels/${novel.id}/chapters?page=${Math.min(safePage + 1, totalPages)}`}>下一页</Link>
          </div>
        </div>
        <div className="grid grid-cols-[80px_1fr_120px_120px_90px_170px] gap-3 border-b border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 max-md:hidden">
          <span>章号</span><span>标题</span><span>细纲</span><span>正文</span><span>字数</span><span>发布</span>
        </div>
        {novel.chapters.map((chapter) => {
          const job = chapter.publicationJobs[0];
          const publishTime = job?.publishedAt || job?.scheduledAt;
          return (
            <Link key={chapter.id} href={`/novels/${novel.id}/chapters/${chapter.id}`} className="grid gap-2 border-b border-slate-100 px-4 py-3 transition hover:bg-[#f8fbfd] md:grid-cols-[80px_1fr_120px_120px_90px_170px]">
              <span className="font-black">第 {chapter.chapterNumber} 章</span>
              <span>
                {chapter.title}
                <span className="muted ml-2 text-sm">{chapter.volume?.title || ""}</span>
              </span>
              <span className="chip w-fit">{chapter.outlineStatus}</span>
              <span className="chip w-fit">{chapter.contentStatus}</span>
              <span>{chapter.wordCount}</span>
              <span className="text-sm">
                {job ? <span className="chip w-fit">{job.status}</span> : <span className="muted">未入队</span>}
                {publishTime ? <span className="muted mt-1 block">{publishTime.toLocaleString("zh-CN", { hour12: false })}</span> : null}
              </span>
            </Link>
          );
        })}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: totalPages }, (_, index) => index + 1)
              .filter((page) => page === 1 || page === totalPages || Math.abs(page - safePage) <= 2)
              .map((page, index, pages) => (
                <span key={page} className="flex items-center gap-2">
                  {index > 0 && page - pages[index - 1] > 1 ? <span className="muted">...</span> : null}
                  <Link className={page === safePage ? "btn" : "btn secondary"} href={`/novels/${novel.id}/chapters?page=${page}`}>{page}</Link>
                </span>
              ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
