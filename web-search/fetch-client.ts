import { extractContent } from "@lamartinecabral/extract-content";
import { Window } from "happy-dom";
import type { FetchResult, SearchResult } from "./utils.ts";

const DUCKDUCKGO_URL = "https://html.duckduckgo.com/html";

export async function isDuckduckgoAvailable() {
  const document = new Window({ url: DUCKDUCKGO_URL }).document;
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
  const url = `${DUCKDUCKGO_URL}/?q=${encodeURIComponent(query)}`;
  const document = new Window({ url }).document;
  try {
    const source = await fetch(url).then((res) => res.text());
    document.write(source);
    const resultElems = [...document.querySelectorAll(".web-result")];

    const results = resultElems
      .map((elem) => {
        const title = innerText(elem.querySelector(".result__title"));
        let url = innerText(elem.querySelector(".result__url"));
        if (url && !url.startsWith("http")) url = `https://${url}`;
        const snippet = innerText(elem.querySelector(".result__snippet"));
        return { title, url, snippet };
      })
      .filter((res) => !!res.snippet);

    if (!results.length) throw new Error();

    document.close();
    return results;
  } catch (_) {
    document.close();
    throw new Error("Web search failed");
  }
};

const webFetch = async (url: string): Promise<FetchResult> => {
  const document = new Window({ url }).document;
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

const innerText = <T extends {}>(elem: T | null) => {
  return elem && "innerText" in elem ? String(elem.innerText).trim() : "";
};

export default {
  webFetch,
  webSearch,
};
