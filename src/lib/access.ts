import { notFound } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function requireOwnedNovel<T extends Omit<Prisma.NovelFindFirstArgs, "where"> = Record<string, never>>(
  novelId: string,
  args?: T,
): Promise<Prisma.NovelGetPayload<T>> {
  const session = await requireSession();
  const novel = await prisma.novel.findFirst({
    ...(args || {}),
    where: { id: novelId, userId: session.userId },
  } as Prisma.NovelFindFirstArgs);
  if (!novel) notFound();
  return novel as Prisma.NovelGetPayload<T>;
}

export async function requireOwnedNovelId(novelId: string) {
  const session = await requireSession();
  const novel = await prisma.novel.findFirst({
    where: { id: novelId, userId: session.userId },
    select: { id: true },
  });
  if (!novel) notFound();
  return novel.id;
}
