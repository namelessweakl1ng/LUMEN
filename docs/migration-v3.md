# V3 migration

V3 removes key-required search integrations and optional GitHub authentication. Searches need no third-party API credentials. Existing provider credential settings can be removed from runtime configuration. Crossref contact identification remains optional; protected operational diagnostics remain available.

Run `python tools/configure.py` before Compose startup. It preserves `.env` settings and creates the internal `LUMEN_PROXY_SECRET` used by both services. Configure secure cookies for HTTPS. See [deployment](deployment.md).

Navigation now has dedicated `/search`, `/workspace`, `/saved`, `/profiles`, `/settings` and `/compare` pages. Advanced filters and diagnostics are available on demand. The logo and wordmark are unchanged; controls and cards use flat rectangular surfaces.

Existing IndexedDB collections and browser profile/preferences storage are preserved. Export JSON before changing origin or clearing storage; deployments on another scheme, host or port cannot read the former origin's data. History remains opt-in. Unsupported or retired engines should not be selected in new profiles; remaining valid local profile settings are retained.

The initial V3 release used five default adapters and retained experimental, disabled DuckDuckGo HTML and Google News RSS modules. PR #5 retired those modules and added enabled arXiv research search. See the [current source registry and access review](engine-adapters.md). Neither release claims comprehensive general-web coverage.

## Screenshots

These screenshots show the production Docker application with live public API results. Capture provenance and checks are recorded in [validation](validation.md).

[Home light](screenshots/v3-home-light.png) · [Home dark](screenshots/v3-home-dark.png) · [Desktop results](screenshots/v3-results-desktop.png) · [Mobile results](screenshots/v3-results-mobile.png) · [Filters](screenshots/v3-filters.png) · [Workspace](screenshots/v3-workspace.png) · [Profiles](screenshots/v3-profiles.png) · [Settings](screenshots/v3-settings.png) · [Comparison](screenshots/v3-comparison.png)

## Validation

See [validation](validation.md). Checks and screenshots must be recorded from the completed V3 build; V2 results are not V3 validation.
