import { getProvider } from "./utils.ts";
import LocalClient, { isChromeAvailable } from "./local-client.ts";
import OllamaClient from "./ollama-client.ts";
import TavilyClient from "./tavily-client.ts";
import FetchClient, { isDuckduckgoAvailable } from "./fetch-client.ts";

export const getWebSearchClient = async () => {
  const provider = await getProvider();
  if (provider.ollama?.apiKey) return OllamaClient;
  if (provider.tavily?.apiKey) return TavilyClient;
  if (isChromeAvailable()) return LocalClient;
  if (await isDuckduckgoAvailable()) return FetchClient;
  throw new Error("Web search feature is not available");
};

export const isWebSearchAvailable = async () => {
  try {
    await getWebSearchClient();
    return true;
  } catch (_) {
    return false;
  }
};
