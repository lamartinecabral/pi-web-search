# pi-web-search

An extension for [pi](https://github.com/earendil-works/pi) that adds web retrieval tools for searching the internet and fetching readable page content.

The extension selects the first available provider in this order:

1. Ollama Web Search, when an Ollama API key is configured.
2. Tavily, when a Tavily API key is configured.
3. A local Chrome-compatible browser using Brave Search, when no API provider is configured.
4. DuckDuckGo's HTML endpoint, when no API provider or compatible browser is available.

Page content returned by the local and DuckDuckGo providers is parsed with [@lamartinecabral/extract-content](https://www.github.com/lamartinecabral/extract-content), which is optimized for LLM comprehension and context-window efficiency.

## Installation

Install the extension directly from GitHub using the pi CLI:

```bash
pi install git:github.com/lamartinecabral/pi-web-search
```

## Available Tools

### `web_search`

Search the live web. Results include a title, URL, and snippet. The local provider may also return extracted page content around the matching snippet.

### `web_fetch`

Extract and parse readable text content from a specific HTTP or HTTPS URL.

## Provider configuration

Create `~/.pi/agent/web-search.config.ts` with a default export containing one or more API keys:

```ts
export default {
  provider: {
    ollama: { apiKey: "your-ollama-api-key" },
    // or tavily: { apiKey: "your-tavily-api-key" },
  },
};
```

If both keys are present, Ollama is used. If neither key is present, the extension tries the local browser provider and then the DuckDuckGo HTML provider. API keys are read from this file; they are not configured through environment variables.

## Requirements

An API key and a local browser are optional. To use the local provider, install a compatible Chrome/Chromium browser. The extension checks these default executable locations:

- macOS: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- Windows: `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`
- Linux: `/usr/bin/google-chrome`

Set `CHROME_PATH` to override the browser executable location:

```bash
CHROME_PATH=/path/to/chrome pi
```

When no API provider or compatible local browser is available, the extension checks whether DuckDuckGo's HTML search endpoint is reachable and uses it when available. The DuckDuckGo fallback requires outbound network access and does not require Chrome/Chromium. If no provider is reachable, the extension does not register the web tools and notifies you when a session starts.

## License

MIT
