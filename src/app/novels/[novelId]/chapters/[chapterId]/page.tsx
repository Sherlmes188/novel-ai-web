import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  aiAction,
  applyChapterRevisionAction,
  discardChapterRevisionAction,
  finalizeChapterAction,
  generateRevisionFromReviewAction,
  schedulePublicationAction,
  updateChapterAction,
} from "@/lib/actions";
import { requireOwnedNovel } from "@/lib/access";
import { prisma } from "@/lib/db";
import { SubmitButton } from "@/components/submit-button";
import { validateGeneratedChapter } from "@/lib/chapter-validation";
import { wordCount } from "@/lib/utils";

const publishStatusLabel: Record<string, string> = {
  PENDING: "待发布",
  RUNNING: "发布中",
  NEEDS_LOGIN: "需人工登录",
  FAILED: "失败",
  PUBLISHED: "已发布",
  CANCELED: "已取消",
};

function datetimeLocal(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

export default async function ChapterPage({ params }: { params: Promise<{ novelId: string; chapterId: string }> }) {
  const { novelId, chapterId } = await params;
  const novel = await requireOwnedNovel(novelId);
  const chapter = await prisma.chapter.findFirstOrThrow({
    where: { id: chapterId, novelId },
    include: {
      publicationJobs: { where: { platform: "fanqie" }, orderBy: { createdAt: "desc" }, take: 1 },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { issues: { orderBy: [{ severity: "desc" }, { createdAt: "asc" }] } },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { sourceReview: true },
      },
    },
  });
  const versions = await prisma.version.findMany({
    where: { targetId: chapterId },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const forbiddenTerms = await prisma.forbiddenTerm.findMany({
    where: { novelId },
    orderBy: [{ severity: "desc" }, { updatedAt: "desc" }],
    take: 120,
  });
  const content = chapter.content || "";
  const contentWordCount = wordCount(content);
  const paragraphs = content.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  const dialogueCount = (content.match(/[“”]/g) || []).length;
  const validation = validateGeneratedChapter(content, { ...novel, forbiddenTerms }, chapter);
  const bannedHits = forbiddenTerms.filter((item) => item.term && content.includes(item.term)).slice(0, 16);
  const publishJob = chapter.publicationJobs[0];
  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 1);
  nextRun.setHours(8, 0, 0, 0);

  return (
    <AppShell title={`第 ${chapter.chapterNumber} 章 / ${chapter.title}`} novelId={novel.id}>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link className="btn secondary" href={`/novels/${novel.id}/chapters`}>返回章节列表</Link>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <form action={updateChapterAction} className="panel grid gap-4 p-5">
          <input type="hidden" name="novelId" value={novel.id} />
          <input type="hidden" name="chapterId" value={chapter.id} />
          <div className="grid gap-4 md:grid-cols-[120px_1fr_180px_180px]">
            <label className="field"><span className="label">章号</span><input className="input" value={chapter.chapterNumber} readOnly /></label>
            <label className="field"><span className="label">标题</span><input className="input" name="title" defaultValue={chapter.title} /></label>
            <label className="field"><span className="label">细纲状态</span><select className="select" name="outlineStatus" defaultValue={chapter.outlineStatus}>
              {["NOT_STARTED", "GENERATED", "PENDING_CONFIRM", "CONFIRMED", "NEED_REVISION"].map((item) => <option key={item}>{item}</option>)}
            </select></label>
            <label className="field"><span className="label">正文状态</span><select className="select" name="contentStatus" defaultValue={chapter.contentStatus}>
              {["NOT_STARTED", "DRAFT", "PENDING_REVIEW", "NEED_REVISION", "POLISHED", "FINALIZED", "EXPORTED"].map((item) => <option key={item}>{item}</option>)}
            </select></label>
          </div>
          <label className="field"><span className="label">章节细纲</span><textarea className="textarea" name="outline" defaultValue={chapter.outline || ""} /></label>
          <label className="field"><span className="label">正文</span><textarea className="textarea min-h-[560px]" name="content" defaultValue={chapter.content || ""} /></label>
          <label className="field"><span className="label">章节摘要</span><textarea className="textarea" name="summary" defaultValue={chapter.summary || ""} /></label>
          <div className="flex flex-wrap gap-2">
            <button className="btn" type="submit">保存章节</button>
          </div>
        </form>

        <aside className="grid content-start gap-5">
          <section className="panel p-5">
            <h2 className="font-black">编辑诊断</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-[#f7f5ef] p-3"><b>{contentWordCount}</b><br /><span className="muted">字数</span></div>
              <div className="rounded-lg bg-[#f7f5ef] p-3"><b>{paragraphs.length}</b><br /><span className="muted">段落</span></div>
              <div className="rounded-lg bg-[#f7f5ef] p-3"><b>{dialogueCount}</b><br /><span className="muted">对话引号</span></div>
              <div className="rounded-lg bg-[#f7f5ef] p-3"><b>{bannedHits.length}</b><br /><span className="muted">禁用命中</span></div>
            </div>
            <div className="mt-3 grid gap-2 text-sm">
              {validation.blockingIssues.map((issue) => <p key={issue} className="rounded-lg bg-red-50 p-2 text-red-700">{issue}</p>)}
              {validation.warnings.map((warning) => <p key={warning} className="rounded-lg bg-yellow-50 p-2 text-yellow-800">{warning}</p>)}
              {bannedHits.length ? <p className="muted">命中：{bannedHits.map((item) => item.term).join("、")}</p> : null}
              {!validation.blockingIssues.length && !validation.warnings.length ? <p className="muted">未发现明显格式风险。</p> : null}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="font-black">AI 操作</h2>
            <div className="mt-3 grid gap-3">
              {[
                ["precheck_chapter", "生成前检查"],
                ["chapter_outline", "生成章节细纲"],
                ["chapter_content", "根据细纲生成正文"],
                ["review_chapter", "结构化审稿"],
              ].map(([taskType, label]) => (
                <form key={taskType} action={aiAction} className="grid gap-2">
                  <input type="hidden" name="novelId" value={novel.id} />
                  <input type="hidden" name="targetType" value="chapter" />
                  <input type="hidden" name="targetId" value={chapter.id} />
                  <input type="hidden" name="taskType" value={taskType} />
                  <textarea className="textarea" name="instruction" placeholder="补充要求，可留空" />
                  <SubmitButton className="btn secondary" pendingText="AI 正在生成...">{label}</SubmitButton>
                </form>
              ))}
            </div>
          </section>

          {chapter.aiReviewStatus ? (
            <section className="panel p-5">
              <h2 className="font-black">最近审稿结果</h2>
              <pre className="mt-3 whitespace-pre-wrap text-sm leading-6">{chapter.aiReviewStatus}</pre>
            </section>
          ) : null}

          <section className="panel p-5">
            <h2 className="font-black">结构化审稿报告</h2>
            <div className="mt-3 grid gap-3">
              {chapter.reviews.map((review) => (
                <details key={review.id} className="rounded-lg border border-[#ded8ca] p-3" open={review.reviewNo === chapter.reviews[0]?.reviewNo}>
                  <summary className="cursor-pointer font-bold">
                    审稿 #{review.reviewNo}
                    <span className="chip ml-2">{review.status}</span>
                    {review.overallScore !== null ? <span className="chip ml-2">{review.overallScore} 分</span> : null}
                  </summary>
                  {review.summary ? <p className="muted mt-3 text-sm leading-6">{review.summary}</p> : null}
                  <div className="mt-3 grid gap-2 text-sm">
                    {review.issues.map((issue) => (
                      <div key={issue.id} className="rounded-lg bg-[#f7f5ef] p-3">
                        <div className="font-bold">[{issue.severity}/{issue.type}] {issue.title}</div>
                        {issue.evidence ? <p className="mt-2">证据：{issue.evidence}</p> : null}
                        <p className="mt-2">{issue.explanation}</p>
                        {issue.suggestion ? <p className="mt-2 text-[#28726a]">建议：{issue.suggestion}</p> : null}
                      </div>
                    ))}
                    {review.issues.length === 0 ? <p className="muted">暂无结构化问题。</p> : null}
                  </div>
                  <form action={generateRevisionFromReviewAction} className="mt-3 grid gap-2">
                    <input type="hidden" name="novelId" value={novel.id} />
                    <input type="hidden" name="chapterId" value={chapter.id} />
                    <input type="hidden" name="reviewId" value={review.id} />
                    <textarea className="textarea" name="instruction" placeholder="补充修订要求，可留空" />
                    <SubmitButton className="btn secondary" pendingText="AI 正在修订...">根据此审稿生成修订版</SubmitButton>
                  </form>
                </details>
              ))}
              {chapter.reviews.length === 0 ? <p className="muted text-sm">执行“结构化审稿”后，这里会保存可追踪的审稿报告。</p> : null}
            </div>
          </section>

          <section className="panel p-5">
            <h2 className="font-black">修订版</h2>
            <div className="mt-3 grid gap-3 text-sm">
              {chapter.revisions.map((revision) => (
                <details key={revision.id} className="rounded-lg border border-[#ded8ca] p-3">
                  <summary className="cursor-pointer font-bold">
                    修订版 #{revision.revisionNo}
                    <span className="chip ml-2">{revision.status}</span>
                    <span className="chip ml-2">{revision.wordCount} 字</span>
                  </summary>
                  {revision.instruction ? <p className="muted mt-3 leading-6">要求：{revision.instruction}</p> : null}
                  {revision.sourceReview ? <p className="muted mt-2">来源：审稿 #{revision.sourceReview.reviewNo}</p> : null}
                  <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs leading-5">{revision.content}</pre>
                  {revision.status === "DRAFT" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={applyChapterRevisionAction}>
                        <input type="hidden" name="novelId" value={novel.id} />
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <input type="hidden" name="revisionId" value={revision.id} />
                        <button className="btn" type="submit">应用到正文</button>
                      </form>
                      <form action={discardChapterRevisionAction}>
                        <input type="hidden" name="novelId" value={novel.id} />
                        <input type="hidden" name="chapterId" value={chapter.id} />
                        <input type="hidden" name="revisionId" value={revision.id} />
                        <button className="btn secondary" type="submit">废弃</button>
                      </form>
                    </div>
                  ) : null}
                </details>
              ))}
              {chapter.revisions.length === 0 ? <p className="muted">暂无修订版。</p> : null}
            </div>
          </section>

          <form action={finalizeChapterAction} className="panel p-5">
            <input type="hidden" name="novelId" value={novel.id} />
            <input type="hidden" name="chapterId" value={chapter.id} />
            <button className="btn w-full" type="submit">标记为定稿</button>
          </form>

          <section className="panel p-5">
            <h2 className="font-black">发布到番茄</h2>
            {publishJob ? (
              <p className="muted mt-2 text-sm leading-6">
                当前状态：{publishStatusLabel[publishJob.status] || publishJob.status}
                <br />
                计划时间：{publishJob.scheduledAt.toLocaleString("zh-CN", { hour12: false })}
              </p>
            ) : null}
            {chapter.contentStatus === "FINALIZED" && chapter.content?.trim() ? (
              <form action={schedulePublicationAction} className="mt-4 grid gap-3">
                <input type="hidden" name="novelId" value={novel.id} />
                <input type="hidden" name="chapterId" value={chapter.id} />
                <label className="field">
                  <span className="label">计划发布时间</span>
                  <input className="input" name="scheduledAt" type="datetime-local" defaultValue={datetimeLocal(nextRun)} required />
                </label>
                <button className="btn w-full" type="submit">{publishJob ? "更新发布计划" : "加入发布队列"}</button>
                <Link className="btn secondary w-full" href={`/novels/${novel.id}/publications`}>查看发布队列</Link>
              </form>
            ) : (
              <p className="muted mt-2 text-sm leading-6">章节定稿且正文不为空后，可以加入发布队列。</p>
            )}
          </section>

          <section className="panel p-5">
            <h2 className="font-black">版本历史</h2>
            <div className="mt-3 grid gap-2 text-sm">
              {versions.map((version) => (
                <details key={version.id} className="rounded-lg border border-[#ded8ca] p-3">
                  <summary className="cursor-pointer font-bold">v{version.versionNumber} {version.changeSummary}</summary>
                  <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5">{version.content}</pre>
                </details>
              ))}
              {versions.length === 0 ? <p className="muted">暂无历史。</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
