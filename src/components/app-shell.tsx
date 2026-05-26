import Link from "next/link";
import { redirect } from "next/navigation";
import { Ban, BookOpen, Brain, FileText, LogOut, NotebookPen, Send, Settings, Sparkles, Users } from "lucide-react";
import { logoutAction } from "@/lib/actions";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const nav = [
  { href: "/novels", label: "小说", icon: BookOpen },
];

const novelNav = [
  { segment: "", label: "工作台", icon: NotebookPen },
  { segment: "outlines", label: "大纲", icon: FileText },
  { segment: "chapters", label: "章节", icon: BookOpen },
  { segment: "characters", label: "人物", icon: Users },
  { segment: "world", label: "世界观", icon: Settings },
  { segment: "banned", label: "禁用库", icon: Ban },
  { segment: "memory", label: "记忆", icon: Brain },
  { segment: "ai-tasks", label: "AI 任务", icon: Sparkles },
  { segment: "ai-models", label: "模型", icon: Settings },
  { segment: "publications", label: "发布", icon: Send },
  { segment: "export", label: "导出", icon: FileText },
];

async function switchNovelAction(formData: FormData) {
  "use server";
  const session = await requireSession();
  const novelId = String(formData.get("novelId") || "");
  const novel = novelId
    ? await prisma.novel.findFirst({ where: { id: novelId, userId: session.userId }, select: { id: true } })
    : null;
  if (novel) {
    redirect(`/novels/${novelId}`);
  }
  redirect("/novels");
}

export async function AppShell({
  children,
  title,
  novelId,
}: {
  children: React.ReactNode;
  title: string;
  novelId?: string;
}) {
  const session = await requireSession();
  const novels = novelId
    ? await prisma.novel.findMany({
        where: { userId: session.userId },
        orderBy: { updatedAt: "desc" },
        select: { id: true, title: true },
      })
    : [];
  const links = novelId
    ? novelNav.map((item) => ({
        href: item.segment ? `/novels/${novelId}/${item.segment}` : `/novels/${novelId}`,
        label: item.label,
        icon: item.icon,
      }))
    : nav;

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-[#ded8ca] bg-[#fffdf8] p-4 lg:block">
        <Link href="/novels" className="mb-6 block text-lg font-black">
          AI 小说创作后台
        </Link>
        {novelId ? (
          <div className="mb-4 grid gap-2">
            <Link href="/novels" className="btn secondary w-full justify-center">
              <BookOpen size={16} />
              返回小说列表
            </Link>
            <form action={switchNovelAction}>
              <select className="select w-full" name="novelId" defaultValue={novelId} onChange={undefined}>
                {novels.map((novel) => (
                  <option key={novel.id} value={novel.id}>{novel.title}</option>
                ))}
              </select>
              <button className="btn secondary mt-2 w-full" type="submit">切换小说</button>
            </form>
          </div>
        ) : null}
        <nav className="grid gap-2">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex items-center gap-2 rounded-lg px-3 py-2 font-semibold text-[#3d433d] hover:bg-[#f1eadb]">
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="absolute bottom-4 left-4 right-4">
          <button className="btn secondary w-full" type="submit">
            <LogOut size={16} />
            退出登录
          </button>
        </form>
      </aside>
      <main className="lg:pl-60">
        <header className="sticky top-0 z-10 border-b border-[#ded8ca] bg-[#f7f5ef]/95 px-4 py-3 backdrop-blur lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-black">{title}</h1>
            <div className="flex flex-wrap gap-2 lg:hidden">
              {novelId ? <Link href="/novels" className="chip">小说列表</Link> : null}
              {links.map((item) => (
                <Link key={item.href} href={item.href} className="chip">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </header>
        <div className="px-4 py-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="panel p-4">
      <div className="muted text-sm font-semibold">{label}</div>
      <div className="mt-2 text-2xl font-black">{value}</div>
    </div>
  );
}
