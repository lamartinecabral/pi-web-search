import { extractContent } from "@lamartinecabral/extract-content";
import { Window } from "happy-dom";
import type { FetchResult, SearchResult } from "./utils.ts";

const DUCKDUCKGO_URL = "https://html.duckduckgo.com/html";

export async function isDuckduckgoAvailable() {
  const document = new Window().document;
  try {
    const source = await fetch(DUCKDUCKGO_URL).then((res) => res.text());
    document.write(source);
    const content = document.getElementById("content_homepage");
    document.close();
    return !!content;
  } catch (_) {
    document.close();
    return false;
  }
}

const webSearch = async (query: string): Promise<SearchResult[]> => {
  const document = new Window().document;
  try {
    const url = `${DUCKDUCKGO_URL}/?q=${encodeURIComponent(query)}`;
    const source = await fetch(url).then((res) => res.text());
    document.write(source);
    const resultElems = [...bang(document.getElementById("links")).children];

    const results = resultElems
      .map((elem) => {
        const title = innerText(elem.querySelector(".result__title"));
        const url = innerText(elem.querySelector(".result__extras"));
        const snippet = innerText(elem.querySelector(".result__snippet"));
        return { title, url, snippet };
      })
      .filter((res) => !!res.snippet);

    if (!results.length) throw new Error();

    document.close();
    return results;
  } catch (_) {
    document.close();
    throw new Error("Could not run web search");
  }
};

const webFetch = async (url: string): Promise<FetchResult> => {
  const document = new Window().document;
  try {
    const source = await fetch(url).then((res) => res.text());
    document.write(source);

    // @ts-expect-error happy-dom Document is compatible with DOM Document for this task
    const { title, content } = extractContent(document);

    document.close();
    return { title, content };
  } catch (_) {
    document.close();
    throw new Error("Could not run web fetch");
  }
};

const bang = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error("value is nil");
  return value;
};

const innerText = <T extends {}>(elem: T | null) => {
  return elem && "innerText" in elem ? String(elem.innerText) : "";
};

export default {
  webFetch,
  webSearch,
};
