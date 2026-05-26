import { AppShell } from "@/components/app-shell";
import { createWorldSettingAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";

export default async function WorldPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: {
      worldSettings: {
        orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
        include: { revisions: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
    },
  });
  return (
    <AppShell title={`${novel.title} / 世界观`} novelId={novel.id}>
      <form action={createWorldSettingAction} className="panel mb-5 grid gap-3 p-5">
        <input type="hidden" name="novelId" value={novel.id} />
        <div className="grid gap-3 md:grid-cols-[1fr_180px_120px]">
          <input className="input" name="title" placeholder="设定标题" />
          <input className="input" name="category" placeholder="分类：修炼/地图/规则" />
          <input className="input" name="importance" type="number" min={1} max={5} defaultValue={3} />
        </div>
        <textarea className="textarea" name="content" placeholder="设定内容" />
        <button className="btn w-fit" type="submit">添加设定</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2">
        {novel.worldSettings.map((setting) => (
          <article key={setting.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black">{setting.title}</h2>
              <span className="chip">{setting.category} / {setting.importance}</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{setting.content}</p>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold">修订历史</summary>
              <div className="mt-2 grid gap-2">
                {setting.revisions.map((revision) => (
                  <div key={revision.id} className="rounded-lg bg-[#f7f5ef] p-3">
                    <div className="muted text-xs">{revision.chapterNumber ? `第 ${revision.chapterNumber} 章` : "未绑定章节"} / {revision.createdBy}</div>
                    {revision.changeReason ? <p className="mt-1 font-bold">{revision.changeReason}</p> : null}
                    <p className="mt-1 whitespace-pre-wrap leading-6">{revision.newContent.slice(0, 500)}</p>
                  </div>
                ))}
                {setting.revisions.length === 0 ? <p className="muted">暂无历史。</p> : null}
              </div>
            </details>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
