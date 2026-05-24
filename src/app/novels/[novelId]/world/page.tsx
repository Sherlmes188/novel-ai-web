import { AppShell } from "@/components/app-shell";
import { createWorldSettingAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";

export default async function WorldPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: { worldSettings: { orderBy: [{ importance: "desc" }, { updatedAt: "desc" }] } },
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
          </article>
        ))}
      </div>
    </AppShell>
  );
}
