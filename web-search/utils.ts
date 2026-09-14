import { join } from "node:path";
import { homedir } from "node:os";

export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type FetchResult = { title: string; content: string };

type Config = {
  provider?: {
    ollama?: { apiKey?: string };
    tavily?: { apiKey?: string };
  };
};

export const getProvider = async (): Promise<
  NonNullable<Config["provider"]>
> => {
  try {
    const { default: config } = await import(
      join(homedir(), ".pi", "agent", "web-search.config.ts")
    );
    return config?.provider || {};
  } catch (_) {
    return {};
  }
};
