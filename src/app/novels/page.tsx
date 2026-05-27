import Link from "next/link";
import { batchGenerateLatestChaptersAction } from "@/lib/actions";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

export default async function NovelsPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string; count?: string }>;
}) {
  const session = await requireSession();
  const { batch, count } = await searchParams;
  const novels = await prisma.novel.findMany({
    where: { userId: session.userId },
    orderBy: { updatedAt: "desc" },
    include: { chapters: true },
  });

  return (
    <AppShell title="小说项目">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-slate-800">管理你的长篇项目、章节草稿和 AI 任务。</p>
          <p className="muted mt-1 text-sm">从方案、大纲、正文到审稿和发布，保持每本书的生产链路清晰。</p>
        </div>
        <Link className="btn" href="/novels/new">创建小说</Link>
      </div>

      {batch === "generated" ? (
        <div className="panel mb-5 p-4 text-sm font-semibold text-[#28726a]">
          已提交 {count || 0} 本小说的批量续写任务。
        </div>
      ) : null}
      {batch === "empty" ? (
        <div className="panel mb-5 p-4 text-sm font-semibold text-red-700">
          请至少选择一本小说。
        </div>
      ) : null}

      {novels.length ? (
        <form action={batchGenerateLatestChaptersAction} className="panel mb-5 grid gap-4 p-5">
          <div className="grid gap-3 md:grid-cols-[160px_1fr_auto]">
            <label className="field">
              <span className="label">每本续写章数</span>
              <input className="input" name="chapterCount" type="number" min={1} max={20} defaultValue={1} />
            </label>
            <label className="field">
              <span className="label">统一补充要求</span>
              <input className="input" name="instruction" placeholder="例如：每章结尾留悬念，避免旁白过多" />
            </label>
            <div className="flex items-end">
              <SubmitButton pendingText="正在批量续写...">批量续写所选小说</SubmitButton>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {novels.map((novel) => {
              const latest = novel.chapters.reduce((max, chapter) => Math.max(max, chapter.chapterNumber), 0);
              return (
                <label key={novel.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm shadow-sm transition hover:border-[#1f7a72]">
                  <span className="flex items-start gap-2">
                    <input className="mt-1" type="checkbox" name="novelIds" value={novel.id} />
                    <span>
                      <b>{novel.title}</b>
                      <span className="muted mt-1 block">当前 {novel.chapters.length} 章，最新第 {latest} 章</span>
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {novels.map((novel) => (
          <Link key={novel.id} href={`/novels/${novel.id}`} className="panel block p-5 transition hover:-translate-y-0.5 hover:border-[#1f7a72] hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-900">{novel.title}</h2>
                <p className="muted mt-1 text-sm">{novel.type}{novel.subtype ? ` / ${novel.subtype}` : ""}</p>
              </div>
              <span className="chip">{novel.status}</span>
            </div>
            <p className="mt-4 line-clamp-3 text-sm leading-6">{novel.summary || "还没有简介。"}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <span className="rounded-lg bg-slate-50 p-2"><b>{novel.chapters.length}</b><br /><span className="muted">章节</span></span>
              <span className="rounded-lg bg-slate-50 p-2"><b>{novel.currentWords}</b><br /><span className="muted">字数</span></span>
              <span className="rounded-lg bg-slate-50 p-2"><b>{formatDate(novel.updatedAt)}</b><br /><span className="muted">更新</span></span>
            </div>
          </Link>
        ))}
      </div>
      {novels.length === 0 ? <div className="panel p-8 text-center muted">还没有小说项目，先创建第一本。</div> : null}
    </AppShell>
  );
}
