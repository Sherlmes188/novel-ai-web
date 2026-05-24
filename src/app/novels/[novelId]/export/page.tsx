import { AppShell } from "@/components/app-shell";
import { requireOwnedNovel } from "@/lib/access";

export default async function ExportPage({ params }: { params: Promise<{ novelId: string }> }) {
  const { novelId } = await params;
  const novel = await requireOwnedNovel(novelId);
  return (
    <AppShell title={`${novel.title} / 导出`} novelId={novel.id}>
      <div className="panel grid max-w-xl gap-3 p-5">
        <p className="muted text-sm">导出按章节号排序，包含已有正文内容。</p>
        <a className="btn" href={`/api/novels/${novel.id}/export/txt`}>导出 TXT</a>
        <a className="btn secondary" href={`/api/novels/${novel.id}/export/markdown`}>导出 Markdown</a>
        <a className="btn secondary" href={`/api/novels/${novel.id}/export/json`}>导出 JSON 备份</a>
      </div>
    </AppShell>
  );
}
