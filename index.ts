import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import puppeteer from "puppeteer-core";
import type { Page } from "puppeteer-core";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description: "Use this tool to retrieve information from the live web.",
    parameters: Type.Object({
      query: Type.String({
        description: "The search terms or question.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const query = String(params.query ?? "").trim();
        if (!query) {
          throw new Error("Query must be a non-empty string.");
        }

        const results = await fullSearchWeb(query);

        const formatted = results
          .map((result) =>
            [
              `**TITLE**: ${result.title}`,
              `**URL**: ${result.url}`,
              result.content
                ? `**CONTENT**:\n\`\`\`\n${result.content}\n\`\`\``
                : `**SNIPPET**: ${result.snippet}`,
            ].join("\n"),
          )
          .join("\n\n");

        return {
          content: [{ text: formatted || "No results found.", type: "text" }],
          details: results,
        };
      } catch (err) {
        throw err;
      }
    },
  });

  pi.registerTool({
    name: "web_fetch",
    label: "Web Fetch",
    description:
      "Extract and parse the raw text content from a specific live website URL.",
    parameters: Type.Object({
      url: Type.String({
        description: "The exact HTTP or HTTPS URL of the web page to scrape.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const url = String(params.url ?? "").trim();
        if (!url) {
          throw new Error("URL must be a non-empty string.");
        }

        const { title, content } = await urlContent(url);

        const formatted = [
          `**TITLE**: ${title}`,
          `**CONTENT**: ${content}`,
        ].join("\n");

        return {
          content: [{ text: formatted, type: "text" }],
          details: { title, content },
        };
      } catch (err) {
        throw err;
      }
    },
  });
}

const chromePath: string =
  process.env.CHROME_PATH ||
  {
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    linux: "/usr/bin/google-chrome",
  }[process.platform as string] ||
  "";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const WEB_TIMEOUT_MS = 25000;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

async function urlContent(query: string) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();
    return await getUrlContent(page, query);
  } finally {
    await browser.close();
  }
}

async function fullSearchWeb(query: string) {
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
}

async function getSearchWebResults(page: Page, query: string) {
  await page.goto(`${BRAVE_SEARCH_URL}/search?q=${encodeURIComponent(query)}`, {
    waitUntil: "domcontentloaded",
    timeout: WEB_TIMEOUT_MS,
  });

  await page.waitForFunction(
    () => {
      const browserDocument = (globalThis as any).document;
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
    const browserDocument = (globalThis as any).document;

    const parsedResults: SearchResult[] = [];

    const snippets = browserDocument.querySelectorAll(
      "main .snippet[data-type='web']",
    );

    for (const snippet of snippets) {
      const url = snippet.querySelector?.("a[href^='http']").href;
      const title = snippet.querySelector?.("a[href^='http'] .title").innerText;

      let text = "";
      const content = snippet.querySelector?.(".content");
      if (content) {
        text = content.innerText;
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
      const browserDocument = (globalThis as any).document;
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
    const browserDocument = (globalThis as any).document;

    const parsedResults: SearchResult[] = [];

    const snippets = browserDocument.querySelectorAll(
      `main .snippet[data-type='news']`,
    );

    for (const snippet of snippets) {
      const url = snippet.querySelector?.("a[href^='http']").href;
      const title = snippet.querySelector?.("a[href^='http'] .title").innerText;

      let text = "";
      const content = snippet.querySelector?.(".content");
      if (content) {
        const description = content.querySelector(".description")?.innerText;
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

export async function getUrlContent(
  page: Page,
  url: string,
): Promise<{ title: string; content: string }> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: WEB_TIMEOUT_MS,
  });

  await page.waitForFunction(
    () => {
      const browserDocument = (globalThis as any).document;
      const hasContent = browserDocument?.body?.innerText.trim().length > 0;
      return hasContent;
    },
    { timeout: WEB_TIMEOUT_MS },
  );

  const [title, content] = await page.evaluate(() => {
    const browserDocument = (globalThis as any).document;

    let text = browserDocument.body?.innerText.trim();
    const title = browserDocument.title?.trim();

    const selectors = [
      "body main",
      "body article",
      "body #content",
      "body .content",
      "body .main",
    ];

    for (const selector of selectors) {
      const elem = browserDocument.querySelector(selector);
      if (!elem) continue;
      const elemText = elem.innerText.trim() ?? "";
      if (elemText.length / text.length > 0.5) {
        text = elemText;
        break;
      }
    }

    return [title, text];
  });

  if (!content) {
    throw new Error("Could not extract content from the page.");
  }

  return { title, content };
}

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
