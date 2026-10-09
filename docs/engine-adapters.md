# Engine adapters

Adapters use documented public interfaces, normalize untrusted payloads and provide capability metadata. They share an asynchronous interface and receive the shared HTTPX client. HTTP failures and malformed payloads must remain visible as engine status rather than invented results.

| Adapter | Interface | Credentials | Scope |
| --- | --- | --- | --- |
| Wikipedia | MediaWiki action API | None | Encyclopedic titles and snippets; general and science categories |
| Wikimedia Commons | MediaWiki action API | None | Images with attribution and licensing metadata |
| GitHub | Repository Search REST API | Optional server-side token | Repositories, stars and language |
| Crossref | REST works API | None; optional contact email | Scholarly metadata, DOI, authors and venue |
| Hacker News | Algolia HN search API | None | Technology discussions and submitted articles |
| Brave | Official web search API | Required optional API key | General web search |

GitHub unauthenticated quotas are limited. Crossref contact identification can enable its polite pool. Wikipedia/Commons are not general-web indexes, Crossref does not guarantee full text, and Hacker News is not comprehensive news coverage. Brave remains unconfigured without a key. Videos, maps and unsupported file-index categories are not advertised as operational.

Use `GET /api/v1/engines` to inspect configured status, category support and filter capabilities. Provider policies and availability can change; deployment operators must comply with current terms and quotas. Fixed outbound destinations prevent arbitrary search proxies.
