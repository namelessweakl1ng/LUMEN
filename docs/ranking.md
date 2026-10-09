# Deterministic ranking

LUMEN combines source position, query-term relevance, cross-source agreement, recency and optional domain preferences. Balanced, relevance and recency modes change the factor weights within a fixed, explainable algorithm. No machine-learning model or provider superiority claim is involved.

Source position is normalized within each result list. Duplicate agreement rewards independently returned canonical URLs. Query relevance compares query terms with title and snippet. Recency applies only where a source supplied a valid publication timestamp; missing timestamps do not invent dates. Preferred domains are explicit local preferences.

Each result returns a `ranking_explanation` with the actual contributing factors and final score. Ties have deterministic ordering. Scores describe this query and ranking configuration, not objective truth, factual accuracy or a calibrated probability. The current weights are:

| Mode | Term coverage | Recency | Reciprocal source position | Preferred domain |
| --- | --- | --- | --- | --- |
| Balanced | 0.55 | 0.15 | 0.20 | 0.10 |
| Relevance | 0.80 | 0 | 0.15 | 0.05 |
| Recency | 0.25 | 0.60 | 0.10 | 0.05 |

Term coverage is the fraction of query tokens present in title/snippet. Source position is `1 / original_rank` from the first merged occurrence. Recency is `1 / (1 + age_days / 30)` when a timestamp exists. A matching preferred domain contributes one before weighting. Each additional source adds 0.05, capped at three additional sources. Ties sort by canonical URL. Recency changes with elapsed time, so determinism assumes the same query, candidate order and evaluation clock. The implementation and tests remain authoritative.
