import z from "zod";
import { getProvider } from "./utils.ts";
import type { FetchResult, SearchResult } from "./utils.ts";

const getApiKey = async () => {
  const provider = await getProvider();
  return provider.tavily?.apiKey || "";
};

const webSearch = async (query: string): Promise<SearchResult[]> => {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, max_results: 5 }),
  }).then((res) => res.text());

  try {
    const { results } = z
      .object({
        results: z.array(
          z.object({
            title: z.coerce.string(),
            url: z.coerce.string(),
            content: z.coerce.string(),
          }),
        ),
      })
      .parse(JSON.parse(response));

    return results.map((res) => ({
      title: res.title,
      url: res.url,
      snippet: res.content,
    }));
  } catch (_) {
    throw new Error("Web search failed");
  }
};

const webFetch = async (url: string): Promise<FetchResult> => {
  const response = await fetch("https://api.tavily.com/extract", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ urls: [url] }),
  }).then((res) => res.text());

  try {
    const { results } = z
      .object({
        results: z.array(
          z.object({
            raw_content: z.coerce.string(),
          }),
        ),
      })
      .parse(JSON.parse(response));

    return {
      title: "",
      content: results[0].raw_content,
    };
  } catch (_) {
    throw new Error("Web fetch failed");
  }
};

export default {
  webFetch,
  webSearch,
};
