# pi-web-search

An extension for [pi](https://github.com/earendil-works/pi) that adds web retrieval tools, allowing the coding agent to perform searches and fetch content from the internet using a local browser via `puppeteer-core`.

The HTML parsing engine is built from scratch specifically optimized to maximize LLM comprehension and context-window efficiency.

## Installation

Install the extension directly from GitHub using the pi CLI:

```bash
pi install git:github.com/lamartinecabral/pi-web-search
```

## Available Tools

### `web_search`
Perform general web searches to retrieve information and snippets from the live web via Brave Search.

### `web_fetch`
Extract and parse the raw text content from a specific URL.

## Requirements

This extension uses `puppeteer-core` to control a local browser (like Google Chrome). Ensure you have a compatible browser installed on your system. You can also specify the path to your executable using the `CHROME_PATH` environment variable.

## License

MIT