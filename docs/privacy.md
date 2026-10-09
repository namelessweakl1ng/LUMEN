# Privacy and security

LUMEN has no mandatory account, trackers, ads or default analytics. The backend does not persist search history or log raw queries. Uvicorn access logging is disabled in supplied startup commands because URLs contain search terms. Operators must apply the same policy to reverse proxies and infrastructure logs.

Search necessarily sends query terms and relevant filters to selected upstream sources. Those services see the backend's network address and apply their own policies. Authentication associates API use with its configured operator account. LUMEN is not an anonymity network and cannot promise provider-side deletion.

Preferences and profiles stay locally in the browser. Research collections and notes use IndexedDB. Optional history starts disabled. Local data deletion controls and JSON/Markdown export are available; changing scheme/host/port creates a separate browser origin and storage area. Browser extensions or someone with device access can inspect this data.

Provider images, when displayed, can cause the browser to contact a remote image host, revealing its IP address and request timing. Image display is subject to source licensing and attribution. There is no silently enabled external favicon service.

The server limits input, request concurrency and deadlines and accepts only fixed provider endpoints. It rejects unsafe result URL schemes. Third-party titles/snippets are rendered as text rather than trusted HTML. The browser uses a same-origin proxy; the backend does not enable cross-origin browser access. Credentials are server-only and diagnostics are disabled unless protected by an operator token.

The short-lived cache contains search material in process memory; restarting the backend clears it. Diagnostics aggregate counts, failures and timing without private query strings. Deployments should restrict network exposure, protect configuration files and review upstream terms.

The default API limit is 120 requests per minute by the direct peer address. A shared reverse proxy may share that bucket across users; the server does not trust arbitrary forwarded IP headers. Deploy a trusted edge limiter if per-client quotas are needed.
