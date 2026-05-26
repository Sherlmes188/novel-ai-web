import { AppShell, Stat } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { indexChapterMemoryAction, rebuildNovelMemoryAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { prisma } from "@/lib/db";
import { searchNovelMemory } from "@/lib/memory";

export default async function MemoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ novelId: string }>;
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const { novelId } = await params;
  const { q = "", type = "" } = await searchParams;
  const novel = await requireOwnedNovel(novelId);
  const [total, missingEmbedding, byType, chapters, recentChunks, results] = await Promise.all([
    prisma.memoryChunk.count({ where: { novelId } }),
    prisma.memoryChunk.count({ where: { novelId, embedding: { equals: undefined } } }),
    prisma.memoryChunk.groupBy({ by: ["sourceType"], where: { novelId }, _count: { _all: true }, orderBy: { sourceType: "asc" } }),
    prisma.chapter.findMany({ where: { novelId }, orderBy: { chapterNumber: "asc" }, select: { id: true, chapterNumber: true, title: true } }),
    prisma.memoryChunk.findMany({
      where: { novelId, sourceType: type || undefined },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    q ? searchNovelMemory(novelId, q, { topK: 12 }) : Promise.resolve([]),
  ]);

  return (
    <AppShell title={`${novel.title} / 长篇记忆`} novelId={novel.id}>
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <Stat label="记忆块" value={total} />
          <Stat label="未生成 embedding" value={missingEmbedding} />
          <Stat label="来源类型" value={byType.length} />
        </div>

        <section className="panel p-5">
          <h2 className="font-black">索引操作</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <form action={rebuildNovelMemoryAction} className="grid gap-2">
              <input type="hidden" name="novelId" value={novel.id} />
              <SubmitButton pendingText="正在重建..." className="btn">重建本书记忆索引</SubmitButton>
            </form>
            <form action={indexChapterMemoryAction} className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input type="hidden" name="novelId" value={novel.id} />
              <select className="select" name="chapterId" required>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>第 {chapter.chapterNumber} 章 / {chapter.title}</option>
                ))}
              </select>
              <SubmitButton pendingText="正在索引..." className="btn secondary">索引章节</SubmitButton>
            </form>
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-black">检索测试</h2>
          <form className="mt-3 grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <input className="input" name="q" defaultValue={q} placeholder="输入章节标题、设定、人物状态或伏笔关键词" />
            <select className="select" name="type" defaultValue={type}>
              <option value="">全部来源</option>
              {byType.map((item) => <option key={item.sourceType} value={item.sourceType}>{item.sourceType}</option>)}
            </select>
            <button className="btn" type="submit">检索</button>
          </form>
          <div className="mt-4 grid gap-3">
            {(q ? results : recentChunks).map((chunk) => (
              <article key={chunk.id} className="rounded-lg border border-[#ded8ca] p-3">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="chip">{chunk.sourceType}</span>
                  {chunk.chapterNumber ? <span className="chip">第 {chunk.chapterNumber} 章</span> : null}
                  {chunk.title ? <span className="font-bold">{chunk.title}</span> : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{chunk.content.slice(0, 900)}</p>
              </article>
            ))}
            {(q ? results : recentChunks).length === 0 ? <p className="muted">暂无记忆块。</p> : null}
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="font-black">来源统计</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {byType.map((item) => <span className="chip" key={item.sourceType}>{item.sourceType}: {item._count._all}</span>)}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
