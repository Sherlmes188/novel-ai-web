import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ novelId: string; format: string }> },
) {
  const session = await getSession();
  if (!session) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const { novelId, format } = await params;
  if (!["json", "md", "txt"].includes(format)) {
    return NextResponse.json({ error: "Unsupported export format" }, { status: 400 });
  }

  const novel = await prisma.novel.findFirst({
    where: { id: novelId, userId: session.userId },
    include: {
      chapters: { orderBy: { chapterNumber: "asc" } },
      characters: true,
      worldSettings: true,
      volumes: true,
      settings: true,
    },
  });
  if (!novel) {
    return NextResponse.json({ error: "Novel not found" }, { status: 404 });
  }
  const filename = encodeURIComponent(novel.title);

  if (format === "json") {
    return new NextResponse(JSON.stringify(novel, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  const markdown = novel.chapters
    .map((chapter) => `# 第 ${chapter.chapterNumber} 章 ${chapter.title}\n\n${chapter.content || ""}`)
    .join("\n\n");
  const body = format === "txt" ? markdown.replace(/^# /gm, "") : `# ${novel.title}\n\n${markdown}`;
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.${format === "txt" ? "txt" : "md"}"`,
    },
  });
}
