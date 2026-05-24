import "dotenv/config";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { chromium, type Locator, type Page } from "playwright";

const prisma = new PrismaClient();

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function formatFanqieTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function cleanChapterContent(content: string) {
  return content.replace(/^\s*#\s*\u7b2c\s*\d+\s*\u7ae0[^\n]*(?:\r?\n)+/, "").trim();
}

function listContainsPublishedChapter(text: string, chapterNumber: number, title: string) {
  return text.includes(`\u7b2c${chapterNumber}\u7ae0`) && text.includes(title);
}

async function isVisible(locator: Locator) {
  try {
    return await locator.first().isVisible({ timeout: 1500 });
  } catch {
    return false;
  }
}

async function fillLocator(page: Page, locator: Locator, value: string) {
  const target = locator.first();
  const contenteditable = await target.evaluate((element) => element.getAttribute("contenteditable")).catch(() => null);
  if (contenteditable === "true") {
    try {
      await target.fill(value);
    } catch {
      await target.evaluate((element, text) => {
        element.textContent = text;
        element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    }
    return;
  }
  try {
    await target.fill(value);
  } catch {
    await target.evaluate((element, text) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = text;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      element.textContent = text;
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    }, value);
  }
}

async function screenshot(page: Page, jobId: string, label: string) {
  const dir = resolve(process.env.FANQIE_SCREENSHOT_DIR || "logs/fanqie-screenshots");
  await mkdir(dir, { recursive: true });
  const filename = `${new Date().toISOString().replace(/[:.]/g, "-")}-${jobId}-${label}.png`;
  const path = resolve(dir, filename);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function dumpPage(page: Page, jobId: string, label: string) {
  const dir = resolve(process.env.FANQIE_SCREENSHOT_DIR || "logs/fanqie-screenshots");
  await mkdir(dir, { recursive: true });
  const prefix = `${new Date().toISOString().replace(/[:.]/g, "-")}-${jobId}-${label}`;
  const htmlPath = resolve(dir, `${prefix}.html`);
  const textPath = resolve(dir, `${prefix}.txt`);
  await writeFile(htmlPath, await page.content(), "utf8");
  await writeFile(textPath, await page.locator("body").innerText().catch(() => ""), "utf8");
  return { htmlPath, textPath };
}

async function clickButtonContaining(page: Page, text: string) {
  const buttons = page.locator("button").filter({ hasText: text });
  const count = await buttons.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const button = buttons.nth(index);
    if (await button.isVisible().catch(() => false)) {
      await button.click();
      return true;
    }
  }
  return false;
}

async function clickAnyButtonLikeContaining(page: Page, text: string) {
  const targets = page.locator("button, [role='button'], .semi-button, .byte-btn").filter({ hasText: text });
  const count = await targets.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const target = targets.nth(index);
    if (await target.isVisible().catch(() => false)) {
      const box = await target.boundingBox().catch(() => null);
      await target.click({ force: true }).catch(() => undefined);
      await target.evaluate((element) => {
        element.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
        element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        if (element instanceof HTMLElement) element.click();
      }).catch(() => undefined);
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => undefined);
      }
      await target.focus().catch(() => undefined);
      await page.keyboard.press("Enter").catch(() => undefined);
      await page.waitForTimeout(300);
      await page.keyboard.press("Space").catch(() => undefined);
      return true;
    }
  }
  return false;
}

async function clickLabelContaining(page: Page, text: string) {
  const labels = page.locator("label").filter({ hasText: text });
  const count = await labels.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const label = labels.nth(index);
    if (await label.isVisible().catch(() => false)) {
      await label.click();
      return true;
    }
  }
  return false;
}

async function clickContinueIfReviewDialogAppears(page: Page) {
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const mayBeReviewDialog =
    bodyText.includes("\u9519\u522b\u5b57") ||
    bodyText.includes("\u53d1\u5e03\u63d0\u793a") ||
    bodyText.includes("\u8bfb\u8005\u7ea0\u9519") ||
    bodyText.includes("\u6821\u5bf9") ||
    bodyText.includes("\u7ea0\u9519") ||
    bodyText.includes("\u654f\u611f\u8bcd");
  if (!mayBeReviewDialog) return false;

  for (const text of [
    "\u5ffd\u7565\u5e76\u53d1\u5e03",
    "\u7ee7\u7eed\u53d1\u5e03",
    "\u4ecd\u7136\u53d1\u5e03",
    "\u786e\u8ba4\u53d1\u5e03",
    "\u7ee7\u7eed\u63d0\u4ea4",
    "\u63d0\u4ea4",
    "\u5ffd\u7565",
    "\u6211\u77e5\u9053\u4e86",
  ]) {
    if (await clickAnyButtonLikeContaining(page, text)) {
      await page.waitForTimeout(1500);
      return true;
    }
  }
  return false;
}

async function clickContentCheckIfAppears(page: Page) {
  const bodyText = await page.locator("body").innerText({ timeout: 3000 }).catch(() => "");
  const mayBeContentCheckDialog =
    bodyText.includes("\u8bf7\u9009\u62e9\u5185\u5bb9\u68c0\u6d4b\u65b9\u5f0f") ||
    bodyText.includes("\u5168\u9762\u68c0\u6d4b") ||
    bodyText.includes("\u57fa\u7840\u68c0\u6d4b");
  if (!mayBeContentCheckDialog) return false;

  for (const text of ["\u4ec5\u57fa\u7840\u68c0\u6d4b", "\u57fa\u7840\u68c0\u6d4b"]) {
    if (await clickAnyButtonLikeContaining(page, text)) {
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      await page.waitForTimeout(30000);
      return true;
    }
  }
  return false;
}

async function confirmFinalPublish(page: Page, jobId: string, publishArticleErrors: string[]) {
  await clickContentCheckIfAppears(page);
  await clickContinueIfReviewDialogAppears(page);
  const beforeConfirm = await screenshot(page, jobId, "before-confirm-publish");
  await clickLabelContaining(page, "\u5426");
  await page.waitForTimeout(800);

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await clickContentCheckIfAppears(page);
    await clickContinueIfReviewDialogAppears(page);
    const clickedConfirm = await clickAnyButtonLikeContaining(page, "\u786e\u8ba4\u53d1\u5e03");
    if (!clickedConfirm) {
      const dump = await dumpPage(page, jobId, "confirm-button-missing");
      throw new Error(`Could not find final confirm publish button. Screenshot: ${beforeConfirm}. Text: ${dump.textPath}. HTML: ${dump.htmlPath}`);
    }

    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    await clickContinueIfReviewDialogAppears(page);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(2500);
    const dailyLimitMessage = publishArticleErrors.find(
      (message) => message.includes("\u6bcf\u65e5\u4e0a\u9650") || message.includes("\u63d0\u4ea4\u5b57\u6570\u8d85\u51fa"),
    );
    if (dailyLimitMessage) {
      throw new DailySubmitLimitError(dailyLimitMessage);
    }

    const publishDialogStillVisible = await page
      .locator("text=\u53d1\u5e03\u8bbe\u7f6e")
      .first()
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!publishDialogStillVisible) {
      return;
    }
  }

  const path = await screenshot(page, jobId, "confirm-publish-still-open");
  const dump = await dumpPage(page, jobId, "confirm-publish-still-open");
  const businessError = publishArticleErrors.at(-1);
  if (businessError) {
    throw new Error(`${businessError}. Screenshot: ${path}. Text: ${dump.textPath}. HTML: ${dump.htmlPath}`);
  }
  throw new Error(`Final publish dialog stayed open after confirm attempts. Screenshot: ${path}. Text: ${dump.textPath}. HTML: ${dump.htmlPath}`);
}

async function delayCurrentAndRemainingJobs({
  jobId,
  novelId,
  chapterNumber,
  delayMinutes,
  status,
  message,
}: {
  jobId: string;
  novelId: string;
  chapterNumber: number;
  delayMinutes: number;
  status: "PENDING" | "NEEDS_LOGIN";
  message: string;
}) {
  const now = new Date();
  const delayedCurrent = new Date(now.getTime() + delayMinutes * 60 * 1000);
  await prisma.publicationJob.update({
    where: { id: jobId },
    data: {
      status,
      scheduledAt: delayedCurrent,
      lastError: message.slice(0, 2000),
    },
  });

  const remaining = await prisma.publicationJob.findMany({
    where: {
      id: { not: jobId },
      novelId,
      platform: "fanqie",
      status: { in: ["PENDING", "FAILED"] },
      chapter: { chapterNumber: { gte: chapterNumber } },
    },
    orderBy: [{ scheduledAt: "asc" }],
  });
  for (const job of remaining) {
    const base = job.scheduledAt > now ? job.scheduledAt : now;
    await prisma.publicationJob.update({
      where: { id: job.id },
      data: {
        status: "PENDING",
        scheduledAt: new Date(base.getTime() + delayMinutes * 60 * 1000),
      },
    });
  }
}

async function assertLoggedIn(page: Page, jobId: string) {
  const captchaSelector = optionalEnv("FANQIE_CAPTCHA_SELECTOR");
  if (captchaSelector && await isVisible(page.locator(captchaSelector))) {
    const path = await screenshot(page, jobId, "captcha");
    throw new NeedsLoginError(`Captcha or risk check detected. Screenshot: ${path}`);
  }

  const loginCheckSelector = optionalEnv("FANQIE_LOGIN_CHECK_SELECTOR");
  if (loginCheckSelector && !(await isVisible(page.locator(loginCheckSelector)))) {
    const path = await screenshot(page, jobId, "login-required");
    throw new NeedsLoginError(`Fanqie login state is invalid. Screenshot: ${path}`);
  }
}

class NeedsLoginError extends Error {}
class DailySubmitLimitError extends Error {}

async function recoverStaleRunningJobs() {
  const maxRunningMinutes = Number(process.env.FANQIE_RUNNING_TIMEOUT_MINUTES || 45);
  const cutoff = new Date(Date.now() - maxRunningMinutes * 60 * 1000);
  const result = await prisma.publicationJob.updateMany({
    where: {
      platform: "fanqie",
      status: "RUNNING",
      updatedAt: { lt: cutoff },
    },
    data: {
      status: "PENDING",
      scheduledAt: new Date(),
      lastError: `Recovered stale RUNNING job after ${maxRunningMinutes} minutes.`,
    },
  });
  if (result.count) {
    console.log(`Recovered ${result.count} stale Fanqie RUNNING job(s).`);
  }
}

function nextDayNoonWindowStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(12, 0, 0, 0);
  return date;
}

function denseDailyWindowTimes(chapters: { wordCount?: number | null; content?: string | null }[], startDay: Date) {
  const result: Date[] = [];
  const lastMinuteByDay = new Map<number, number>();
  const maxDailyWords = Math.max(Number(process.env.FANQIE_MAX_DAILY_WORDS || 10000), 1);
  let dayOffset = 0;
  let wordsInDay = 0;
  let slot = 0;

  for (const chapter of chapters) {
    const chapterWords = Math.max(chapter.wordCount || wordCountForPublish(chapter.content || ""), 1);
    if (wordsInDay > 0 && wordsInDay + chapterWords > maxDailyWords) {
      dayOffset += 1;
      wordsInDay = 0;
      slot = 0;
    }

    const date = new Date(startDay);
    date.setDate(startDay.getDate() + dayOffset);

    const previousMinute = lastMinuteByDay.get(dayOffset);
    const minute = slot === 0 || previousMinute === undefined
      ? Math.floor(Math.random() * 8)
      : previousMinute + 3 + Math.floor(Math.random() * 10);
    lastMinuteByDay.set(dayOffset, minute);
    date.setHours(12, Math.min(minute, 179), Math.floor(Math.random() * 60), 0);
    result.push(date);
    wordsInDay += chapterWords;
    slot += 1;
  }
  return result;
}

function wordCountForPublish(content: string) {
  const chinese = content.match(/[\u4e00-\u9fff]/g)?.length || 0;
  const asciiWords = content.replace(/[\u4e00-\u9fff]/g, " ").match(/[A-Za-z0-9]+/g)?.length || 0;
  return chinese + asciiWords;
}

async function rescheduleCurrentAndRemainingForDailyLimit({
  jobId,
  novelId,
  chapterNumber,
  message,
}: {
  jobId: string;
  novelId: string;
  chapterNumber: number;
  message: string;
}) {
  const jobs = await prisma.publicationJob.findMany({
    where: {
      novelId,
      platform: "fanqie",
      status: { in: ["PENDING", "FAILED", "RUNNING"] },
      chapter: { chapterNumber: { gte: chapterNumber } },
    },
    include: { chapter: true },
    orderBy: [{ chapter: { chapterNumber: "asc" } }],
  });
  const times = denseDailyWindowTimes(jobs.map((job) => job.chapter), nextDayNoonWindowStart());
  for (let index = 0; index < jobs.length; index += 1) {
    await prisma.publicationJob.update({
      where: { id: jobs[index].id },
      data: {
        status: "PENDING",
        scheduledAt: times[index],
        lastError: jobs[index].id === jobId ? message.slice(0, 2000) : null,
      },
    });
  }
}

async function publishJob() {
  await recoverStaleRunningJobs();

  const fallbackWorkspaceUrl = requiredEnv("FANQIE_WORKSPACE_URL");
  const fallbackPublishUrl = optionalEnv("FANQIE_PUBLISH_URL");
  const storageState = resolve(process.env.FANQIE_STORAGE_STATE || ".auth/fanqie.json");
  if (!existsSync(storageState)) {
    throw new NeedsLoginError(`Missing Fanqie storage state: ${storageState}. Run npm run fanqie:login first.`);
  }

  const pending = await prisma.publicationJob.findFirst({
    where: {
      platform: "fanqie",
      status: { in: ["PENDING", "FAILED"] },
      scheduledAt: { lte: new Date() },
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    include: { chapter: true, novel: true },
  });
  if (!pending) {
    console.log("No due Fanqie publication job.");
    return;
  }
  const workspaceUrl = pending.novel.fanqieWorkspaceUrl || fallbackWorkspaceUrl;
  const publishUrl = pending.novel.fanqiePublishUrl || fallbackPublishUrl;

  const claimed = await prisma.publicationJob.updateMany({
    where: { id: pending.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "RUNNING",
      attempts: { increment: 1 },
      lastError: null,
    },
  });
  if (claimed.count !== 1) {
    console.log(`Job ${pending.id} was already claimed.`);
    return;
  }

  const browser = await chromium.launch({
    headless: process.env.PW_HEADLESS !== "0",
    executablePath: process.env.FANQIE_CHROME_EXECUTABLE || undefined,
  });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  const publishArticleErrors: string[] = [];
  page.on("response", async (response) => {
    const url = response.url();
    if (!url.includes("publish_article")) return;
    const text = await response.text().catch(() => "");
    if (text) {
      try {
        const payload = JSON.parse(text) as { code?: number; message?: string };
        if (payload.code && payload.code !== 0) {
          publishArticleErrors.push(payload.message || text);
        }
      } catch {
        if (response.status() >= 400) publishArticleErrors.push(text);
      }
    }
  });
  if (process.env.FANQIE_DEBUG_NETWORK === "1") {
    page.on("request", (request) => {
      const url = request.url();
      if (/chapter|publish|audit|submit|content|check/i.test(url)) {
        console.log(`[fanqie request] ${request.method()} ${url}`);
      }
    });
    page.on("response", async (response) => {
      const url = response.url();
      if (/chapter|publish|audit|submit|content|check/i.test(url)) {
        const shouldPrintBody = response.status() >= 400 || url.includes("publish_article");
        const text = shouldPrintBody ? await response.text().catch(() => "") : "";
        console.log(`[fanqie response] ${response.status()} ${url} ${text.slice(0, 500)}`);
      }
    });
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        console.log(`[fanqie console:${message.type()}] ${message.text().slice(0, 500)}`);
      }
    });
  }

  try {
    if (!pending.chapter.content?.trim()) {
      throw new Error(`Chapter ${pending.chapter.id} has no content.`);
    }

    await page.goto(publishUrl || workspaceUrl, { waitUntil: "domcontentloaded" });
    const loginCheckSelector = optionalEnv("FANQIE_LOGIN_CHECK_SELECTOR");
    if (loginCheckSelector) {
      await page.locator(loginCheckSelector).first().waitFor({ state: "visible", timeout: 30000 }).catch(() => undefined);
    }
    await assertLoggedIn(page, pending.id);

    if (!publishUrl) {
      await page.locator(requiredEnv("FANQIE_NEW_CHAPTER_SELECTOR")).first().click();
    }
    const chapterNumberSelector = optionalEnv("FANQIE_CHAPTER_NUMBER_SELECTOR");
    if (chapterNumberSelector) {
      const chapterNumber = page.locator(chapterNumberSelector).first();
      await chapterNumber.click();
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
      await page.keyboard.type(String(pending.chapter.chapterNumber));
      await chapterNumber.evaluate((element) => {
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }
    await fillLocator(page, page.locator(requiredEnv("FANQIE_TITLE_SELECTOR")), pending.chapter.title);
    await fillLocator(page, page.locator(requiredEnv("FANQIE_CONTENT_SELECTOR")), cleanChapterContent(pending.chapter.content));

    const scheduleSelector = optionalEnv("FANQIE_SCHEDULE_SELECTOR");
    if (scheduleSelector) {
      await fillLocator(page, page.locator(scheduleSelector), formatFanqieTime(pending.scheduledAt));
    }

    const beforeSubmit = await screenshot(page, pending.id, "before-submit");
    if (process.env.FANQIE_CONFIRM_SUBMIT === "next-only") {
      await page.locator(requiredEnv("FANQIE_SUBMIT_SELECTOR")).first().click();
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
      const afterNext = await screenshot(page, pending.id, "after-next-only");
      throw new Error(`Clicked next only and stopped before final submit. Screenshot: ${afterNext}`);
    }

    if (process.env.FANQIE_CONFIRM_SUBMIT !== "yes") {
      throw new Error(`Filled page but did not submit because FANQIE_CONFIRM_SUBMIT is not "yes". Screenshot: ${beforeSubmit}`);
    }

    await page.locator(requiredEnv("FANQIE_SUBMIT_SELECTOR")).first().click();
    await page.waitForTimeout(2000);
    await clickContentCheckIfAppears(page);
    await clickContinueIfReviewDialogAppears(page);
    await confirmFinalPublish(page, pending.id, publishArticleErrors);
    await screenshot(page, pending.id, "after-submit");

    await page.goto(workspaceUrl, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8000);
    const listText = await page.locator("body").innerText();
    if (!listContainsPublishedChapter(listText, pending.chapter.chapterNumber, pending.chapter.title)) {
      const path = await screenshot(page, pending.id, "published-list-missing");
      throw new Error(`Submitted but chapter was not found in Fanqie chapter list. Screenshot: ${path}`);
    }

    await prisma.publicationJob.update({
      where: { id: pending.id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        lastError: null,
      },
    });
    console.log(`Published queued Fanqie chapter: ${pending.novel.title} / ${pending.chapter.title}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isLoginProblem = error instanceof NeedsLoginError;
    const isDailyLimit = error instanceof DailySubmitLimitError;
    const attemptsAfterThisRun = pending.attempts + 1;
    const delayMinutes = attemptsAfterThisRun <= 1 ? 30 : 120;
    if (isDailyLimit) {
      await rescheduleCurrentAndRemainingForDailyLimit({
        jobId: pending.id,
        novelId: pending.novelId,
        chapterNumber: pending.chapter.chapterNumber,
        message,
      });
      console.error(message);
      return;
    } else if (isLoginProblem) {
      await delayCurrentAndRemainingJobs({
        jobId: pending.id,
        novelId: pending.novelId,
        chapterNumber: pending.chapter.chapterNumber,
        delayMinutes,
        status: "NEEDS_LOGIN",
        message,
      });
    } else {
      await delayCurrentAndRemainingJobs({
        jobId: pending.id,
        novelId: pending.novelId,
        chapterNumber: pending.chapter.chapterNumber,
        delayMinutes,
        status: "PENDING",
        message,
      });
    }
    console.error(message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

publishJob()
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

