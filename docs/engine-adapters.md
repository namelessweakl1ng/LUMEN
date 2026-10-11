# Production search adapters

These specialized sources support developer, research and knowledge discovery. They do not provide a web-scale index; query coverage depends on source selection, provider access and quotas.

The registry in `backend/app/engines/sources.py` contains the six supported public API adapters below. All are enabled on startup without provider credentials or engine flags. Metadata from `/api/v1/engines` reports the provider, categories, filters, pagination, request ceiling, minimum interval, timeout and current availability. A successful HTTP response alone is never treated as a valid result: each adapter parses and validates actual records.

| Provider | Categories | Interface and limits | Coverage |
| --- | --- | --- | --- |
| Wikipedia | General, science | MediaWiki public API; 30 requests/minute per backend | Encyclopedia articles |
| GitHub repositories | General, developer | Public REST API; 6 requests/minute per backend | Repository titles and descriptions |
| Crossref papers | General, science | Public REST API; 30 requests/minute per backend | Research metadata, not guaranteed full text |
| Hacker News | General, developer, news | Public Algolia API; 30 requests/minute per backend | Technology submissions and discussion |
| Wikimedia Commons | Images | MediaWiki public API; 30 requests/minute per backend | Licensed media records |
| arXiv | Science | Public Atom API; 20 requests/minute and one request every 3 seconds, serialized | Research preprints and abstracts |

The bundled Docker deployment has one backend process. [arXiv API terms](https://info.arxiv.org/help/api/tou.html) require one connection and at least three seconds between requests **across all operator machines**. The adapter serializes and spaces requests inside one process. Multi-replica deployments must add shared rate coordination before using arXiv; the process-local limiter alone does not satisfy the cross-machine condition. The [arXiv API manual](https://info.arxiv.org/help/api/user-manual.html) documents Atom, pagination and sorting. arXiv descriptive metadata is available for discovery, with provider attribution through each result's origin.

`CROSSREF_MAILTO` is optional contact identification, not an API key. Fixed HTTPS destinations, bounded response sizes, result URL validation, deadlines, rate budgets, and partial-failure status apply to every source. HTTP 403 and HTML challenges stop requests and enter a cooldown; HTTP 429 and 503 `Retry-After` values are respected. The service does not bypass challenges or rotate proxies. Local site, extension and fallback date filters apply to retrieved candidates, not entire upstream indexes. Pagination is source-specific and `has_more` is conservative; without upstream totals a full page cannot prove another matching page exists.

## Provider-access review — 2026-10-11

- [DuckDuckGo robots.txt](https://duckduckgo.com/robots.txt) disallows `/html` and `/lite`, and its [Acceptable Use Policy](https://duckduckgo.com/acceptable-use) raises display restrictions for use in another service. The previous experimental HTML adapter and flag were removed; there is no DuckDuckGo production coverage.
- [Google Search robots.txt](https://www.google.com/robots.txt) disallows `/search` for the general user agent. [Google terms](https://policies.google.com/terms) prohibit automation contrary to machine-readable instructions. [Google News robots.txt](https://news.google.com/robots.txt) disallows RSS search paths. The prior RSS adapter and flag were removed; there is no Google Search or Google News coverage.
- Bing, Mojeek, Brave, Yahoo and Ecosia official access documentation could not be retrieved through this cloud proxy (HTTP 403). Permission for automated keyless metasearch was not verified, so none was added or queried.
- [Stack Exchange API documentation](https://api.stackexchange.com/docs) describes anonymous access, quota and backoff. Its complete [API legal terms](https://stackexchange.com/legal/api-terms-of-use) could not be retrieved through this proxy, so no adapter was enabled.
- The existing GitHub, Crossref and MediaWiki documentation pages also returned proxy HTTP 403 during this review. Their public API adapters returned valid live results, but this environment could not independently reverify the current complete access terms. Deployers remain responsible for current provider conditions and quotas.

The five existing providers and arXiv cover specialized indexes that fit LUMEN's developer and research discovery scope. No Google, Bing, DuckDuckGo or comprehensive web coverage is claimed. Provider restrictions and outages may make individual sources unavailable; queries still reach the selected upstream services.
