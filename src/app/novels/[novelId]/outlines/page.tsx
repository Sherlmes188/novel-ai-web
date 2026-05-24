import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { createVolumeAction, generateVolumeOutlinesAction, saveGlobalOutlineAction, updateVolumeAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";

export default async function OutlinesPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: { settings: true, volumes: { orderBy: { startChapterNumber: "asc" } } },
  });
  const outline = novel.settings.find((item) => item.type === "global_outline");

  return (
    <AppShell title={`${novel.title} / 大纲`} novelId={novel.id}>
      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <div className="panel p-4"><div className="muted text-sm font-semibold">目标章节</div><div className="mt-1 text-xl font-black">{novel.targetChapters || "未设置"}</div></div>
        <div className="panel p-4"><div className="muted text-sm font-semibold">已规划分卷</div><div className="mt-1 text-xl font-black">{novel.volumes.length}</div></div>
        <div className="panel p-4"><div className="muted text-sm font-semibold">分卷覆盖</div><div className="mt-1 text-xl font-black">{coverageText(novel.volumes)}</div></div>
        <div className="panel p-4"><div className="muted text-sm font-semibold">总纲状态</div><div className="mt-1 text-xl font-black">{outline?.content ? "已生成" : "未生成"}</div></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
        <section className="grid gap-5">
          <form action={saveGlobalOutlineAction} className="panel grid gap-4 p-5">
            <input type="hidden" name="novelId" value={novel.id} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">总大纲</h2>
                <p className="muted mt-1 text-sm">建议按“阶段、章节范围、冲突、爽点、伏笔回收”组织，后续分卷会以这里为母版。</p>
              </div>
              <SubmitButton className="btn w-fit" pendingText="正在保存...">保存总大纲</SubmitButton>
            </div>
            <textarea className="textarea min-h-[680px] leading-7" name="content" defaultValue={outline?.content || ""} />
          </form>
        </section>

        <aside className="grid content-start gap-5 xl:sticky xl:top-24">
          <form action={generateVolumeOutlinesAction} className="panel grid gap-3 p-5">
            <input type="hidden" name="novelId" value={novel.id} />
            <input type="hidden" name="mode" value="replace" />
            <h2 className="font-black">AI 生成分卷卷纲</h2>
            <p className="muted text-sm leading-6">
              按目标章节数 {novel.targetChapters || "未设置"} 连续规划全书分卷。会覆盖当前分卷列表，但不会删除已有章节正文。
            </p>
            <textarea className="textarea" name="instruction" placeholder="例如：每卷约50章；前期升级快；中期扩地图；后期揭示真相。" />
            <SubmitButton pendingText="AI 正在生成分卷...">AI 生成/重生成分卷</SubmitButton>
          </form>

          <form action={createVolumeAction} className="panel grid gap-3 p-5">
            <input type="hidden" name="novelId" value={novel.id} />
            <h2 className="font-black">手动新增分卷</h2>
            <input className="input" name="title" placeholder="卷名" />
            <div className="grid grid-cols-2 gap-3">
              <input className="input" name="startChapterNumber" type="number" placeholder="起始章" />
              <input className="input" name="endChapterNumber" type="number" placeholder="结束章" />
            </div>
            <textarea className="textarea" name="summary" placeholder="本卷概要" />
            <SubmitButton pendingText="正在添加...">添加分卷</SubmitButton>
          </form>

          <section className="panel max-h-[760px] overflow-y-auto p-3">
            <div className="sticky top-0 z-10 border-b border-[#ded8ca] bg-[#fffdf8] p-2">
              <h2 className="font-black">分卷卷纲</h2>
              <p className="muted text-sm">分卷多时可在这里滚动逐卷修改。</p>
            </div>
            <div className="grid gap-3 pt-3">
              {novel.volumes.map((volume) => (
                <form key={volume.id} action={updateVolumeAction} className="grid gap-3 rounded-lg border border-[#ded8ca] bg-[#fffdf8] p-4">
                  <input type="hidden" name="novelId" value={novel.id} />
                  <input type="hidden" name="volumeId" value={volume.id} />
                  <input className="input font-bold" name="title" defaultValue={volume.title} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input" name="startChapterNumber" type="number" defaultValue={volume.startChapterNumber} />
                    <input className="input" name="endChapterNumber" type="number" defaultValue={volume.endChapterNumber} />
                  </div>
                  <textarea className="textarea" name="summary" placeholder="本卷概要" defaultValue={volume.summary || ""} />
                  <textarea className="textarea" name="mainGoal" placeholder="本卷目标" defaultValue={volume.mainGoal || ""} />
                  <textarea className="textarea" name="mainConflict" placeholder="主要冲突" defaultValue={volume.mainConflict || ""} />
                  <textarea className="textarea" name="climax" placeholder="卷末高潮" defaultValue={volume.climax || ""} />
                  <SubmitButton className="btn secondary" pendingText="正在保存...">保存本卷</SubmitButton>
                </form>
              ))}
              {novel.volumes.length === 0 ? <p className="muted p-4">还没有分卷，先用 AI 生成或手动新增。</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}

function coverageText(volumes: { startChapterNumber: number; endChapterNumber: number }[]) {
  if (volumes.length === 0) return "0";
  const start = Math.min(...volumes.map((item) => item.startChapterNumber));
  const end = Math.max(...volumes.map((item) => item.endChapterNumber));
  return `${start}-${end}`;
}
