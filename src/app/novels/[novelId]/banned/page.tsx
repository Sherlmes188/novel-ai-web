import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/submit-button";
import { createForbiddenTermAction, deleteForbiddenTermAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";

export default async function BannedTermsPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: { forbiddenTerms: { orderBy: [{ severity: "desc" }, { updatedAt: "desc" }] } },
  });

  return (
    <AppShell title={`${novel.title} / 禁用库`} novelId={novel.id}>
      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createForbiddenTermAction} className="panel grid content-start gap-3 p-5">
          <input type="hidden" name="novelId" value={novel.id} />
          <h2 className="text-lg font-black">添加禁用表达</h2>
          <p className="muted text-sm leading-6">用于排除网络烂梗、过度套路、违背作品气质的表达。后续 AI 生成正文、细纲和审稿都会读取这里。</p>
          <label className="field">
            <span className="label">禁用词 / 烂梗 / 套路</span>
            <input className="input" name="term" placeholder="例如：恐怖如斯、桀桀桀、你已有取死之道" required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span className="label">分类</span>
              <input className="input" name="category" defaultValue="meme" />
            </label>
            <label className="field">
              <span className="label">严重度 1-5</span>
              <input className="input" name="severity" type="number" min={1} max={5} defaultValue={3} />
            </label>
          </div>
          <label className="field">
            <span className="label">备注</span>
            <textarea className="textarea" name="note" placeholder="说明为什么禁用，或允许的替代表达风格。" />
          </label>
          <SubmitButton pendingText="正在添加...">添加到禁用库</SubmitButton>
        </form>

        <section className="panel overflow-hidden">
          <div className="border-b border-[#ded8ca] p-4">
            <h2 className="font-black">当前禁用库</h2>
          </div>
          <div className="divide-y divide-[#eee7d8]">
            {novel.forbiddenTerms.map((item) => (
              <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[1fr_120px_90px_auto]">
                <div>
                  <div className="font-black">{item.term}</div>
                  {item.note ? <p className="muted mt-1 text-sm leading-6">{item.note}</p> : null}
                </div>
                <span className="chip w-fit">{item.category}</span>
                <span className="chip w-fit">严重度 {item.severity}</span>
                <form action={deleteForbiddenTermAction}>
                  <input type="hidden" name="novelId" value={novel.id} />
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn danger" type="submit">删除</button>
                </form>
              </div>
            ))}
            {novel.forbiddenTerms.length === 0 ? <p className="muted p-6">还没有禁用表达。</p> : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
