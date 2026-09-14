import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import {
  isWebSearchAvailable,
  getWebSearchClient,
} from "./web-search/index.ts";

export default function (pi: ExtensionAPI) {
  isWebSearchAvailable().then((webSearchAvailable) => {
    if (!webSearchAvailable) {
      pi.on("session_start", (_, ctx) => {
        if (ctx.hasUI) ctx.ui.notify("Web Search is not available");
      });
    } else {
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

            const client = await getWebSearchClient();
            const results = await client.webSearch(query);

            const formatted = results
              .map((result) =>
                [
                  `**TITLE**: ${result.title}`,
                  `**URL**: ${result.url}`,
                  "content" in result
                    ? `**CONTENT**:\n\`\`\`\`\n${result.content}\n\`\`\`\``
                    : `**SNIPPET**: ${result.snippet}`,
                ].join("\n"),
              )
              .join("\n\n");

            return {
              content: [
                { text: formatted || "No results found.", type: "text" },
              ],
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
            description:
              "The exact HTTP or HTTPS URL of the web page to scrape.",
          }),
        }),
        async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
          try {
            const url = String(params.url ?? "").trim();
            if (!url) {
              throw new Error("URL must be a non-empty string.");
            }

            const client = await getWebSearchClient();
            const { title, content } = await client.webFetch(url);

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
  });
}
