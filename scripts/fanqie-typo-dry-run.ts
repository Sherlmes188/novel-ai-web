import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function screenshot(page: Page, label: string) {
  const dir = resolve(process.env.FANQIE_SCREENSHOT_DIR || "logs/fanqie-screenshots");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-typo-dry-run-${label}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`Screenshot ${label}: ${path}`);
}

async function dumpText(page: Page, label: string) {
  const dir = resolve(process.env.FANQIE_SCREENSHOT_DIR || "logs/fanqie-screenshots");
  await mkdir(dir, { recursive: true });
  const path = resolve(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-typo-dry-run-${label}.txt`);
  await writeFile(path, await page.locator("body").innerText().catch(() => ""), "utf8");
  console.log(`Text ${label}: ${path}`);
}

async function clickButtonContaining(page: Page, text: string) {
  const buttons = page.locator("button, [role='button'], .arco-btn, .semi-button, .byte-btn").filter({ hasText: text });
  const count = await buttons.count();
  for (let index = count - 1; index >= 0; index -= 1) {
    const button = buttons.nth(index);
    if (await button.isVisible().catch(() => false)) {
      await button.click({ force: true });
      return true;
    }
  }
  return false;
}

async function dismissGuides(page: Page) {
  for (let index = 0; index < 6; index += 1) {
    const body = await page.locator("body").innerText().catch(() => "");
    const hasGuide = body.includes("这里可以设置分卷") || body.includes("为你的创作之旅增加色彩和氛围");
    if (!hasGuide) return;
    if (!(await clickButtonContaining(page, "下一步"))) return;
    await page.waitForTimeout(800);
  }
}

async function fillLocator(page: Page, selector: string, value: string) {
  const target = page.locator(selector).first();
  await target.waitFor({ state: "visible", timeout: 30000 });
  const contenteditable = await target.evaluate((element) => element.getAttribute("contenteditable")).catch(() => null);
  if (contenteditable === "true") {
    await target.fill("");
    await target.click();
    await page.keyboard.insertText(value);
    return;
  }
  await target.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.insertText(value);
}

async function main() {
  const title = `错别字弹窗测试${new Date().toISOString().slice(11, 19).replace(/:/g, "")}`;
  const content = [
    "清晨，陈峰认真检察魔法塔的图纸。",
    "他发现这里的布署有些马唬，需要从新校队一遍。",
    "奥古斯都说，这种写法会触发错别字检查。",
    "这是自动化测试章节，只走到确认发布弹窗，不会点击最终确认发布。",
  ].join("\n\n").repeat(14);

  const browser = await chromium.launch({
    headless: process.env.PW_HEADLESS !== "0",
    executablePath: process.env.FANQIE_CHROME_EXECUTABLE || undefined,
  });
  const context = await browser.newContext({ storageState: resolve(process.env.FANQIE_STORAGE_STATE || ".auth/fanqie.json") });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);

  page.on("response", async (response) => {
    const url = response.url();
    if (/correction|pre_audit|publish_article|check/i.test(url)) {
      const text = await response.text().catch(() => "");
      console.log(`[response] ${response.status()} ${url} ${text.slice(0, 500)}`);
    }
  });

  await page.goto(requiredEnv("FANQIE_PUBLISH_URL"), { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.locator(requiredEnv("FANQIE_SUBMIT_SELECTOR")).first().waitFor({ state: "visible", timeout: 45000 });
  await dismissGuides(page);

  const chapterNumberSelector = process.env.FANQIE_CHAPTER_NUMBER_SELECTOR?.trim();
  if (chapterNumberSelector) {
    const chapterNumber = page.locator(chapterNumberSelector).first();
    await chapterNumber.click();
    await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    await page.keyboard.type(process.env.FANQIE_TYPO_TEST_CHAPTER_NUMBER || "51");
    await chapterNumber.evaluate((element) => {
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  await fillLocator(page, requiredEnv("FANQIE_TITLE_SELECTOR"), title);
  await fillLocator(page, requiredEnv("FANQIE_CONTENT_SELECTOR"), content);
  await screenshot(page, "filled");

  await page.locator(requiredEnv("FANQIE_SUBMIT_SELECTOR")).first().click();
  await page.waitForTimeout(3000);
  await screenshot(page, "after-next");
  await dumpText(page, "after-next");

  const bodyAfterNext = await page.locator("body").innerText().catch(() => "");
  if (bodyAfterNext.includes("错别字") || bodyAfterNext.includes("发布提示")) {
    const clickedTypoSubmit = await clickButtonContaining(page, "提交");
    console.log(`Clicked typo submit: ${clickedTypoSubmit}`);
    await page.waitForTimeout(3000);
    await screenshot(page, "after-typo-submit");
    await dumpText(page, "after-typo-submit");
  }

  const clickedBasicCheck = await clickButtonContaining(page, "仅基础检测");
  console.log(`Clicked basic check: ${clickedBasicCheck}`);
  await page.waitForTimeout(35000);
  await screenshot(page, "after-basic-check");
  await dumpText(page, "after-basic-check");

  const body = await page.locator("body").innerText().catch(() => "");
  for (const text of ["错别字", "读者纠错", "忽略", "继续发布", "确认发布", "发布设置"]) {
    console.log(`Visible text "${text}": ${body.includes(text)}`);
  }
  console.log("Stopped before final confirm publish on purpose.");
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
