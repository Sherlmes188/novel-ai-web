import { AppShell } from "@/components/app-shell";
import { createCharacterAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";

export default async function CharactersPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: {
      characters: {
        orderBy: { updatedAt: "desc" },
        include: { stateHistory: { orderBy: { createdAt: "desc" }, take: 5 } },
      },
    },
  });
  return (
    <AppShell title={`${novel.title} / 人物`} novelId={novel.id}>
      <form action={createCharacterAction} className="panel mb-5 grid gap-3 p-5">
        <input type="hidden" name="novelId" value={novel.id} />
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="name" placeholder="姓名" />
          <input className="input" name="identity" placeholder="身份" />
          <input className="input" name="cultivationLevel" placeholder="境界/能力等级" />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <textarea className="textarea" name="personality" placeholder="性格与说话方式" />
          <textarea className="textarea" name="currentStatus" placeholder="当前状态" />
        </div>
        <textarea className="textarea" name="notes" placeholder="备注、秘密、人物弧光" />
        <button className="btn w-fit" type="submit">添加人物</button>
      </form>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {novel.characters.map((character) => (
          <article key={character.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black">{character.name}</h2>
              <span className="chip">{character.isAlive ? "存活" : "离场"}</span>
            </div>
            <p className="muted mt-1 text-sm">{character.identity || "身份未定"} {character.cultivationLevel ? ` / ${character.cultivationLevel}` : ""}</p>
            <p className="mt-3 text-sm leading-6">{character.personality || "暂无性格记录。"}</p>
            <p className="mt-3 text-sm leading-6"><b>状态：</b>{character.currentStatus || "暂无"}</p>
            {character.notes ? <p className="mt-3 text-sm leading-6"><b>备注：</b>{character.notes}</p> : null}
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-bold">状态时间线</summary>
              <div className="mt-2 grid gap-2">
                {character.stateHistory.map((item) => (
                  <div key={item.id} className="rounded-lg bg-[#f7f5ef] p-3">
                    <div className="muted text-xs">{item.chapterNumber ? `第 ${item.chapterNumber} 章` : "未绑定章节"} / {item.source}</div>
                    <p className="mt-1 leading-6">{item.eventSummary || "无摘要"}</p>
                    {item.powerLevel ? <p className="muted mt-1">能力：{item.powerLevel}</p> : null}
                    {item.items ? <p className="muted mt-1">物品：{item.items}</p> : null}
                  </div>
                ))}
                {character.stateHistory.length === 0 ? <p className="muted">暂无历史。</p> : null}
              </div>
            </details>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
