# Engine adapters

Adapters normalize untrusted payloads and report failures rather than invented results. All default sources work without third-party credentials. Keyless access still has quotas, terms and availability limits.

| Adapter | Interface | Scope | Default |
| --- | --- | --- | --- |
| Wikipedia | MediaWiki action API | Encyclopedic titles and snippets | Enabled |
| Wikimedia Commons | MediaWiki action API | Images with attribution and licensing metadata | Enabled |
| GitHub | Unauthenticated Repository Search REST API | Public repositories, stars and language | Enabled |
| Crossref | REST works API | Scholarly metadata, DOI, authors and venue | Enabled |
| Hacker News | Algolia HN search API | Technology discussions and submitted articles | Enabled |
| Google News RSS | Public news search feed, fixed en-US edition | News articles and publishers; first page only | Disabled pending permission |
| DuckDuckGo HTML | Experimental unofficial HTML parsing | General results; first page only | Disabled |

GitHub's unauthenticated quotas are limited. `CROSSREF_MAILTO` is optional contact identification for responsible provider use, not an API credential. Wikipedia/Commons are not general-web indexes; Crossref does not guarantee full text; Hacker News is not comprehensive news coverage. Google News RSS is not Google Web Search. No Google, Bing or Brave Web Search coverage is claimed. Maps, videos and a dedicated file index remain unavailable.

`GET /api/v1/engines` exposes engine IDs, names, supported categories and filters, pagination, availability, interface type, access notes, deadlines and request quotas. Treat deployed metadata as authoritative: filtering and pagination are source-specific and may change. Local domain, extension and date filters inspect retrieved candidates, not entire provider indexes.

DuckDuckGo HTML requires explicit `LUMEN_ENABLE_DDG_HTML=1` opt-in only when automated access is permitted for the deployment. Public readability is not permission to automate. Challenges, blocks, unexpected markup and size-limit failures are surfaced as unavailable/error statuses. The adapter stops rather than bypassing controls, and challenge/rate-limit cooldowns suppress repeated requests. The flag grants no permission and does not guarantee access.

Provider policies and operational availability can change. Deployment operators must review current terms and quotas. Fixed outbound destinations prevent arbitrary search proxies; adapter fixtures prove parser contracts, not live availability. No additional general-web adapter is advertised without adequate permission and operational evidence.

## Provider access review — 2026-10-10

The retrieved [Google terms](https://policies.google.com/terms) prohibit “using automated means to access content from any of our services in violation of the machine-readable instructions on our web pages”. [Google News robots.txt](https://news.google.com/robots.txt) declares `User-agent: *` and `Disallow: /`; its selective Allow list does not include `/rss` or `/rss/search`. The RSS parser remains tested, but `LUMEN_ENABLE_GOOGLE_NEWS_RSS=0` disables it by default pending documented provider permission. A successful request demonstrates functionality, not permitted use. Do not enable it merely because the endpoint responds.

[DuckDuckGo terms](https://duckduckgo.com/terms) did not establish express permission for this HTML metasearch use. Its HTML robots file allowing `/` does not alone grant permission. It therefore remains experimental and disabled.

The review found specialized candidates rather than a permitted general-web replacement. [arXiv API terms](https://info.arxiv.org/help/api/tou.html) permit descriptive metadata reuse but require a single connection and at least three seconds between requests across the operator's machines. [Stack Exchange API documentation](https://api.stackexchange.com/docs) supports anonymous access with polling, quota, backoff and attribution obligations. Neither adapter is added: those operational boundaries require implementation and neither offers full-web coverage. Some GitHub, Crossref and MediaWiki reference pages remained blocked by the cloud proxy, so their current terms text is not represented as freshly verified.
