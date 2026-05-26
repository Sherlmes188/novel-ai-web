import { AppShell } from "@/components/app-shell";
import { createAiModelConfigAction, toggleAiModelConfigAction } from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { prisma } from "@/lib/db";

export default async function AiModelsPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId);
  const configs = await prisma.aiModelConfig.findMany({ orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }] });

  return (
    <AppShell title={`${novel.title} / AI 模型配置`} novelId={novel.id}>
      <form action={createAiModelConfigAction} className="panel mb-5 grid gap-3 p-5">
        <input type="hidden" name="novelId" value={novel.id} />
        <div className="grid gap-3 md:grid-cols-3">
          <input className="input" name="name" placeholder="配置名，如 审稿模型" />
          <input className="input" name="provider" defaultValue="openai_compatible" />
          <input className="input" name="model" placeholder="模型名" />
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_180px_160px]">
          <input className="input" name="baseUrl" placeholder="Base URL" />
          <input className="input" name="apiKeyRef" defaultValue="DEEPSEEK_API_KEY" />
          <input className="input" name="purpose" placeholder="planning drafting review" />
        </div>
        <div className="grid gap-3 md:grid-cols-[160px_160px_auto]">
          <input className="input" name="temperature" type="number" step="0.1" placeholder="温度" />
          <input className="input" name="maxTokens" type="number" placeholder="Max tokens" />
          <button className="btn" type="submit">添加模型配置</button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {configs.map((config) => (
          <article key={config.id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{config.name}</h2>
                <p className="muted mt-1 text-sm">{config.provider} / {config.model}</p>
              </div>
              <span className="chip">{config.enabled ? "启用" : "停用"}</span>
            </div>
            <p className="mt-3 break-all text-sm">{config.baseUrl}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {config.purpose.map((item) => <span className="chip" key={item}>{item}</span>)}
            </div>
            <form action={toggleAiModelConfigAction} className="mt-4">
              <input type="hidden" name="novelId" value={novel.id} />
              <input type="hidden" name="id" value={config.id} />
              <button className="btn secondary" type="submit">{config.enabled ? "停用" : "启用"}</button>
            </form>
          </article>
        ))}
      </div>
    </AppShell>
  );
}
