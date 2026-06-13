import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import puppeteer from "puppeteer-core";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "web_search",
    label: "Web Search",
    description:
      "Search the live web for current events, news, or general real-time information.",
    parameters: Type.Object({
      query: Type.String({
        description: "The specific search query to execute.",
      }),
    }),
    async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
      try {
        const query = String(params.query ?? "").trim();
        if (!query) {
          throw new Error("Query must be a non-empty string.");
        }

        const results = await searchNews(query);

        const formatted = results
          .map((result) =>
            [
              `**SOURCE**: ${result.url}`,
              `**TITLE**: ${result.title}`,
              `**SNIPPET**: ${result.snippet}`,
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
    name: "fetch_url_content",
    label: "Fetch URL Content",
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

        const { title, content } = await getUrlContent(url);

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

export const chromePath: string =
  process.env.CHROME_PATH ||
  {
    darwin: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    win32: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    linux: "/usr/bin/google-chrome",
  }[process.platform as string] ||
  "";

const BRAVE_SEARCH_URL = "https://search.brave.com";
const MAX_RESULTS = 10;
const WEB_TIMEOUT_MS = 25000;

type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export async function searchNews(query: string) {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

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
        const title = snippet.querySelector?.(
          "a[href^='http'] .title",
        ).innerText;

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
    }, MAX_RESULTS);

    if (!results.length) {
      return [];
    }

    return results;
  } finally {
    await browser.close();
  }
}

export async function getUrlContent(
  url: string,
): Promise<{ title: string; content: string }> {
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: false,
  });

  try {
    const page = await browser.newPage();

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
  } finally {
    await browser.close();
  }
}
