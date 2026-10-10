# V3 validation record

Validated on 2026-10-10 against the V3 branch. Backend: Ruff and mypy passed; 108 pytest tests passed (one upstream Starlette deprecation warning). Frontend: lint and TypeScript passed; 74 unit tests across 11 files passed; production build passed. All 26 full-stack Playwright tests passed through the fixture-enabled FastAPI server.

Required checks: backend Ruff, mypy and pytest; frontend lint, TypeScript, unit tests, production build and Playwright; Compose configuration, image builds, runtime health and same-origin search; reviewed desktop, mobile, light and dark screenshots. Keep any blocked or failed check explicit.

Live smoke uses [`tools/live_smoke.py`](../tools/live_smoke.py), makes one request per enabled source, and records failures without invented results. It is optional and separate from deterministic fixtures. Provider errors or empty results must not be reported as successful live availability.

The [fixture benchmark](../benchmarks/fixture_search.py) uses injected transport responses. Its latency and cache figures do not measure live-provider performance. Historical JSON artifacts may remain for provenance; replace or date current artifacts before citing them as V3 results.

## Live source observation — 2026-10-10

An initial live smoke, before completion of provider-policy review, returned three results from each of five default public API sources and the then-enabled Google News RSS adapter. DuckDuckGo HTML was disabled and received no request. These measurements were reported by the integration run and are preserved in [live-smoke-results.json](live-smoke-results.json); they are source-request latency, not end-to-end search performance, permission evidence or a future availability guarantee. Google News RSS was subsequently disabled after terms/robots review; no further live Google requests are authorized by this record.

| Source | Results | Request latency |
| --- | --- | --- |
| Wikipedia | 3 | 955.258 ms |
| GitHub | 3 | 779.793 ms |
| Crossref | 3 | 511.323 ms |
| Hacker News | 3 | 508.371 ms |
| Wikimedia Commons | 3 | 825.440 ms |
| Google News RSS | 3 | 987.146 ms |

Compose configuration, both production image builds and both container health checks passed. Same-origin production search returned three actual results for python. Builds used the cloud trust bundle and proxy through BuildKit secrets, without disabling TLS verification. A final frontend image rebuild exhausted disk space; pruning unused older build cache restored capacity and the rebuild passed.

Nine screenshots were captured from the production Docker application using live public API results without response interception, then inspected twice. Automated checks found no horizontal overflow, rounded controls or gradients. A missing link-arrow glyph found in the first inspection was replaced before final capture. See [visual checks](screenshots/v3-visual-checks.json) and [screenshots](migration-v3.md#screenshots). The logo/wordmark file is byte-for-byte unchanged. Browser storage migration, keyboard handling, profile sanitization, comparison attribution and cross-tab notes have regression coverage. Hosted CI results are tracked on the PR separately; local validation does not imply a hosted CI result.
