# pi-web-search

An extension for [pi](https://github.com/earendil-works/pi) that adds web retrieval tools for searching the internet and fetching readable page content.

The extension selects the first available provider in this order:

1. Ollama Web Search, when an Ollama API key is configured.
2. Tavily, when a Tavily API key is configured.
3. A local Chrome-compatible browser using Brave Search, when its Chrome executable path is configured.
4. DuckDuckGo's HTML endpoint, when no API provider or compatible browser is available.

Page content returned by the local and DuckDuckGo providers is parsed with [@lamartinecabral/extract-content](https://www.github.com/lamartinecabral/extract-content), which is optimized for LLM comprehension and context-window efficiency.

## Installation

Install the extension directly from GitHub using the pi CLI:

```bash
pi install git:github.com/lamartinecabral/pi-web-search
```

## Configuration

Create `~/.pi/agent/web-search.config.ts` and export a default object with a
`provider` property. The available provider options and selection behavior come
from the [web-search client](https://github.com/lamartinecabral/web-search). To
use Ollama or Tavily, set the matching API key in your environment and reference
it here:

```ts
export default {
  provider: {
    ollama: { apiKey: process.env.OLLAMA_API_KEY },
    // tavily: { apiKey: process.env.TAVILY_API_KEY },
  },
};
```

To use local Chrome, configure its executable path; use `"default"` to detect
the standard path for your platform (or set the `CHROME_PATH` environment
variable):

```ts
export default {
  provider: {
    local: { chromePath: "default" },
  },
};
```

You can also set `chromePath` to the full path of your Chrome executable. If no
provider is configured, the extension uses DuckDuckGo when it is reachable.

## Available Tools

### `web_search`

Search the live web. Results include a title, URL, and snippet. The local provider may also return extracted page content around the matching snippet.

### `web_fetch`

Extract and parse readable text content from a specific HTTP or HTTPS URL.

## License

MIT
