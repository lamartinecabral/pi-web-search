import fs from "node:fs";
import { extractContent } from "@lamartinecabral/extract-content";
import type { Page } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import type { FetchResult, SearchResult } from "./utils.ts";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const WEB_TIMEOUT_MS = 25000;

const chromePath: string | undefined =
  process.env.CHROME_PATH ||
  {
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    linux: "/usr/bin/google-chrome",
  }[process.platform as string];

export function isChromeAvailable() {
  if (!chromePath) return false;

  try {
    fs.accessSync(chromePath, fs.constants.F_OK | fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

const webSearch = async (query: string): Promise<SearchResult[]> => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

    const allResults: (SearchResult & { content?: string })[] = [];

    for (const getResults of [getSearchWebResults, getSearchNewsResults]) {
      const results: typeof allResults = await getResults(page, query);

      for (const result of results) {
        try {
          const { content } = await getUrlContent(page, result.url);
          if (content) {
            const index = contentContainsSnippet(content, result.snippet);
            if (index === null) continue; // If snippet is not found, skip this result
            const portionSize = 20000;
            result.content = content.slice(
              Math.max(0, index - portionSize / 2),
              index + portionSize / 2,
            ); // Only keep a portion of the content around the snippet to save space
            break;
          }
        } catch (_) {
          continue; // If fetching content fails, skip to the next result
        }
      }

      results.sort((a, b) => (a.content ? 0 : 1) - (b.content ? 0 : 1)); // Prioritize results with content
      allResults.push(...results.slice(0, 5));
    }

    return allResults;
  } finally {
    await browser.close();
  }
};

async function getSearchWebResults(page: Page, query: string) {
  await page.goto(`${BRAVE_SEARCH_URL}/search?q=${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
    timeout: WEB_TIMEOUT_MS,
  });

  await page.waitForFunction(
    () => {
      const browserDocument = globalThis.document;
      const main = browserDocument?.querySelector?.("main");
      if (!main) return false;

      const hasResults =
        main.querySelector(
          "article, [data-type='web'], .snippet, .result, a[href^='http']",
        ) !== null;
      const noResults = /no results|did not match any documents/i.test(
        main.textContent ?? "",
      );

      return hasResults || noResults;
    },
    { timeout: WEB_TIMEOUT_MS },
  );

  const results = await page.evaluate((maxResults) => {
    const cleanText = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const browserDocument = globalThis.document;

    const parsedResults: SearchResult[] = [];

    const snippets = browserDocument.querySelectorAll(
      "main .snippet[data-type='web']",
    );

    for (const snippet of snippets) {
      // @ts-ignore
      const url = snippet.querySelector?.("a[href^='http']").href;
      // @ts-ignore
      const title = snippet.querySelector?.("a[href^='http'] .title").innerText;

      let text = "";
      const content = snippet.querySelector?.(".content");
      if (content) {
        // @ts-ignore
        text = content.innerText;
        // @ts-ignore
        const when = content.querySelector?.(".t-secondary")?.innerText;
        if (when) text = text.replace(when, "");
      }

      parsedResults.push({
        title: title,
        url: url,
        snippet: cleanText(text),
      });

      if (parsedResults.length >= maxResults) break;
    }

    return parsedResults;
  }, 10);

  if (!results.length) {
    return [];
  }

  return results;
}

async function getSearchNewsResults(page: Page, query: string) {
  await page.goto(
    `${BRAVE_SEARCH_URL}/news?spellcheck=0&q=${encodeURIComponent(query)}`,
    {
      waitUntil: "domcontentloaded",
      timeout: WEB_TIMEOUT_MS,
    },
  );

  await page.waitForFunction(
    () => {
      const browserDocument = globalThis.document;
      const main = browserDocument?.querySelector?.("main");
      if (!main) return false;

      const hasResults =
        main.querySelector(
          `article, [data-type='news'], .snippet, .result, a[href^='http']`,
        ) !== null;
      const noResults = /no results|did not match any documents/i.test(
        main.textContent ?? "",
      );

      return hasResults || noResults;
    },
    { timeout: WEB_TIMEOUT_MS },
  );

  const results = await page.evaluate((maxResults) => {
    const cleanText = (value: string | null | undefined) =>
      (value ?? "").replace(/\s+/g, " ").trim();
    const browserDocument = globalThis.document;

    const parsedResults: SearchResult[] = [];

    const snippets = browserDocument.querySelectorAll(
      `main .snippet[data-type='news']`,
    );

    for (const snippet of snippets) {
      // @ts-ignore
      const url = snippet.querySelector?.("a[href^='http']").href;
      // @ts-ignore
      const title = snippet.querySelector?.("a[href^='http'] .title").innerText;

      let text = "";
      const content = snippet.querySelector?.(".content");
      if (content) {
        // @ts-ignore
        const description = content.querySelector(".description")?.innerText;
        // @ts-ignore
        const age = content.querySelector(".age-snippet")?.innerText;
        text = cleanText(`${age} - ${description}`);
      }

      parsedResults.push({
        title: title,
        url: url,
        snippet: text,
      });

      if (parsedResults.length >= maxResults) break;
    }

    return parsedResults;
  }, 10);

  if (!results.length) {
    return [];
  }

  return results;
}

const webFetch = async (url: string): Promise<FetchResult> => {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();
    return await getUrlContent(page, url);
  } finally {
    await browser.close();
  }
};

async function getUrlContent(page: Page, url: string): Promise<FetchResult> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: WEB_TIMEOUT_MS,
  });

  await page.waitForFunction(
    () => {
      const browserDocument = globalThis.document;
      const hasContent = browserDocument?.body?.innerText.trim().length > 0;
      return hasContent;
    },
    { timeout: WEB_TIMEOUT_MS },
  );

  const { title, content } = await page.evaluate(extractContent);

  if (!content) {
    throw new Error("Could not extract content from the page.");
  }

  return { title, content };
}

/**
 * Checks if the content contains the snippet with at least 60% similarity using a longest common subsequence approach in overlapping chunks.
 * Returns the index of the content chunk where the snippet is found, or null if not found.
 */
const contentContainsSnippet = (
  content: string,
  snippet: string,
): null | number => {
  if (!snippet) return null;
  const a = snippet.toLowerCase();
  const m = a.length;
  for (let i = 0; i < content.length; i += m) {
    const chunk = content.slice(i, i + m * 2);
    if (chunk.length < m) break;
    const b = chunk.toLowerCase();
    const n = b.length;
    // dp[i][j] = LCS length of a[0..i-1] and b[0..j-1]
    const dp: number[] = new Array(n + 1).fill(0);
    let prev;
    for (let i = 1; i <= m; i++) {
      prev = 0;
      for (let j = 1; j <= n; j++) {
        const temp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev + 1 : Math.max(dp[j], dp[j - 1]);
        prev = temp;
      }
    }
    if (dp[n] / m >= 0.6) return i;
  }
  return null;
};

export default {
  webFetch,
  webSearch,
};
