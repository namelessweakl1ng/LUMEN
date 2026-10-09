# Search execution

A query contains category, selected engines, language, time range, safe-search mode, page, limit, domain include/exclude filters, optional file type, ranking mode and preferred domains. Unsupported categories are unavailable instead of silently returning unrelated data.

The registry supplies eligible, configured engines. Adapter requests execute concurrently, constrained by a semaphore and source throttling. Deadlines prevent one slow provider from holding the whole response indefinitely. Successful sources remain useful when others fail; statuses distinguish failures from empty responses. Pending tasks are cleaned up when the deadline expires.

Canonical URLs remove fragments and known tracking parameters while retaining resource-identifying query parameters. Duplicate results merge attribution and useful metadata. Ranking uses normalized source positions rather than combining incomparable provider scores.

Domain, file type and publication-time checks can be local post-filters. They operate on retrieved candidates and may yield fewer results than requested; they are not equivalent to provider-side full-index filtering. Engine metadata identifies supported upstream filters. Pagination is bounded and provider-specific: returned counts describe this response, not an exact total across the web.

The default cache holds at most 128 entries for 120 seconds. The default overall query deadline is nine seconds with an eight-second per-engine timeout and outbound concurrency of twelve. The bounded TTL cache keys every query/filter and engine selection. Only successful responses are reusable; errors must not become durable search results. It stores queries transiently in memory to form keys, without persistent history or raw query logs. Cache behavior differs across workers and instances.

Ranking is performed within the retrieved page. Each adapter uses its own pagination; `has_more` is best effort when a source fills the requested page, not a globally reranked cursor or a guarantee of another result.
