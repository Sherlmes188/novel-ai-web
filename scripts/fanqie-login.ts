import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { chromium } from "playwright";

const workspaceUrl = process.env.FANQIE_WORKSPACE_URL?.trim();
const storageState = resolve(process.env.FANQIE_STORAGE_STATE || ".auth/fanqie.json");

if (!workspaceUrl) {
  throw new Error("FANQIE_WORKSPACE_URL is required. Set it to the Fanqie author chapter/workspace page.");
}
const fanqieWorkspaceUrl = workspaceUrl;

async function main() {
  await mkdir(dirname(storageState), { recursive: true });
  const headless = process.env.PW_HEADLESS === "1";
  const browser = await chromium.launch({
    headless,
    executablePath: process.env.FANQIE_CHROME_EXECUTABLE || undefined,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(fanqieWorkspaceUrl, { waitUntil: "domcontentloaded" });

  const rl = createInterface({ input, output });
  await rl.question(
    [
      "Please finish Fanqie login in the opened browser.",
      "If a captcha appears, solve it manually.",
      "Press Enter here after the workspace page is fully available...",
      "",
    ].join("\n"),
  );
  rl.close();

  await context.storageState({ path: storageState });
  await browser.close();
  console.log(`Saved Fanqie login state to ${storageState}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
