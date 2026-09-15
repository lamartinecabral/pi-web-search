import puppeteer from "puppeteer-core";
import { extractContent } from "@lamartinecabral/extract-content";

const chromePath: string =
  process.env.CHROME_PATH ||
  {
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    linux: "/usr/bin/google-chrome",
  }[process.platform as string] ||
  "";

async function main() {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://www.google.com.br", {
    waitUntil: "domcontentloaded",
  });

  await page.waitForFunction(() => {
    const browserDocument = (globalThis as any).document;
    const hasContent = browserDocument?.body?.innerText.trim().length > 0;
    return hasContent;
  });

  const res = await page.evaluate(extractContent);

  console.log(res);

  await browser.close();
}

main();
