# Validation record

Validated on 2026-10-10 against the V3 branch. Backend: Ruff and mypy passed; 108 pytest tests passed (one upstream Starlette deprecation warning). Frontend: lint and TypeScript passed; 74 unit tests across 11 files passed; production build passed. All 26 full-stack Playwright tests passed through the fixture-enabled FastAPI server.

Required checks: backend Ruff, mypy and pytest; frontend lint, TypeScript, unit tests, production build and Playwright; Compose configuration, image builds, runtime health and same-origin search; reviewed desktop, mobile, light and dark screenshots. Keep any blocked or failed check explicit.

Live smoke uses [`tools/live_smoke.py`](../tools/live_smoke.py), makes one request per enabled source, and records failures without invented results. It is optional and separate from deterministic fixtures. Provider errors or empty results must not be reported as successful live availability.

The [fixture benchmark](../benchmarks/fixture_search.py) uses injected transport responses. Its latency and cache figures do not measure live-provider performance. Historical JSON artifacts may remain for provenance; replace or date current artifacts before citing them as V3 results.

## Live source observation — 2026-10-10

An initial live smoke, before completion of provider-policy review, returned three results from each of five default public API sources and the then-enabled Google News RSS adapter. DuckDuckGo HTML was disabled and received no request. These historical measurements are preserved in [live-smoke-v3-results.json](live-smoke-v3-results.json); they are source-request latency, not end-to-end search performance, permission evidence or a future availability guarantee. Google News RSS was subsequently disabled after terms/robots review; no further live Google requests are authorized by this record.

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

## PR #5 provider and search observations — 2026-10-11

Six production public API sources were queried once each through `tools/live_smoke.py` for `python`. All returned three real normalized results. This establishes observed availability on this date, not permission by itself or a long-term uptime guarantee. The [JSON evidence](live-smoke-results.json) records per-source latency: Wikipedia 1462.383 ms, GitHub 746.178 ms, Crossref 912.697 ms, Hacker News 765.025 ms, Commons 1036.780 ms, arXiv 532.343 ms. arXiv also returned one real Atom record in a separate bounded query while verifying its protocol; its three-second spacing and single-process limit are tested with an injected clock.

Five real user-query samples used the actual aggregation service with no fixtures. Counts below are returned results at `limit=5`, and timings are single observations, not p95 latency:

| Query | Category | Returned | Total response | Source status |
| --- | --- | ---: | ---: | --- |
| Python FastAPI tutorial | General | 5 | 660.7 ms | 4/4 succeeded |
| Best Linux distributions for developers | General | 5 | 693.5 ms | 4/4 succeeded |
| Docker Compose networking | Developer | 5 | 534.0 ms | 2/2 succeeded |
| Machine learning research papers | Science | 5 | 1661.7 ms | 3/3 succeeded, including arXiv |
| Latest cybersecurity news | News | 5 | 241.9 ms | 1/1 succeeded |

Relevance remains weak for broad queries: the Linux sample's first result was a repository overview and the cybersecurity sample consisted of Hacker News submissions, not comprehensive fresh news. These observations describe the limits of LUMEN's specialized discovery scope. Provider access evidence and unverified permissions are detailed in [adapters](engine-adapters.md#provider-access-review--2026-10-11).

PR #5 local verification: Ruff and mypy passed, **105 backend tests** passed (one Starlette test-client deprecation warning), frontend lint and TypeScript passed, **74 unit tests** passed, the production build passed and **30 full-stack Playwright tests** passed. Docker Compose configuration and both production image builds passed using the cloud trust/proxy override. Both containers became healthy. Through the running production frontend, `/api/v1/health` returned `ok`; engine metadata listed precisely the six enabled sources; a live science search returned three real results with Wikipedia, Crossref and arXiv all reporting success and an arXiv result present. These are current-instance results, not a hosted CI claim.

The nine V3 production screenshots were recaptured after the small frontend review fixes and visually inspected. The updated scanner checks every visible element for gradients, all four control corners for rounding and horizontal overflow; [its evidence](screenshots/v3-visual-checks.json) recorded none. The wordmark source file is unchanged. PR #5 now positions LUMEN for developer and research discovery; general-web coverage is outside that product scope. Fresh complete terms verification for some existing providers remains unresolved.

The scope-alignment update changes homepage, profile and About copy without changing search behavior or stored profile formats. The retired-provider cleanup removes the remaining unsupported frontend interface types and an unused settings panel containing stale Google News RSS copy; historical records and tests that verify retired sources stay unavailable remain. Backend Ruff, mypy and 105 pytest tests passed; frontend lint, TypeScript, 74 unit tests and the production build passed; 31 full-stack Playwright tests passed. Compose configuration and both image builds passed, and both containers became healthy. The production same-origin health endpoint returned `ok`, and engine metadata listed all six sources enabled. Updated light and dark home, profile and Settings About screenshots were checked for overflow, rounded controls and gradients; the remaining screens were unchanged.

## Main consolidation — 2026-10-20

PRs #1–#4 were already ancestors of `main`; the five commits from PR #5 were fast-forwarded onto `main`. Backend Ruff and mypy passed, and 105 pytest tests passed. Frontend lint and TypeScript passed, 74 unit tests passed, and the production build passed. All 31 full-stack Playwright tests passed against the fixture-backed FastAPI server. Docker Compose configuration, both production image builds, container health checks and same-origin `/api/v1/health` passed using the cloud trust/proxy override without disabling TLS verification.

Three live searches through the production frontend returned results: General (`python`, limit 3) reported Wikipedia, GitHub, Crossref and Hacker News success; Science reported Wikipedia, Crossref and arXiv success with an arXiv result; Images reported Wikimedia Commons success with three image results. These checks covered all six production sources on this date. They are single observations, not uptime or provider-policy guarantees. The repository root README was refreshed for the public showcase, and three unreferenced pre-V3 screenshots were removed; the V3 screenshots and historical migration evidence remain.
