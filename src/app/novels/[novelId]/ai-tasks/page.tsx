import { AppShell } from "@/components/app-shell";
import { requireOwnedNovel } from "@/lib/access";
import { formatDate } from "@/lib/utils";

export default async function AiTasksPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId, {
    include: { aiTasks: { orderBy: { createdAt: "desc" }, take: 80 } },
  });
  return (
    <AppShell title={`${novel.title} / AI 任务`} novelId={novel.id}>
      <div className="grid gap-3">
        {novel.aiTasks.map((task) => (
          <details key={task.id} className="panel p-5">
            <summary className="cursor-pointer">
              <span className="font-black">{task.taskType}</span>
              <span className="chip ml-3">{task.status}</span>
              <span className="muted ml-3 text-sm">{formatDate(task.createdAt)}</span>
            </summary>
            {task.errorMessage ? <pre className="mt-4 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-sm text-red-700">{task.errorMessage}</pre> : null}
            {task.outputContent ? <pre className="mt-4 whitespace-pre-wrap text-sm leading-6">{task.outputContent}</pre> : null}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-bold">查看 Prompt</summary>
              <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap text-xs leading-5">{task.prompt}</pre>
            </details>
          </details>
        ))}
      </div>
    </AppShell>
  );
}
