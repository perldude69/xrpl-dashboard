XRP Price Update Flow - Review Prompt for Reviewer

Objective:
Audit changes and code changes made to address stale/duplicate price emissions and broken graph loading. Ensure correctness, minimal regressions, and adequate test coverage.

What to review:
- Changes in xrpl.js: Are subscriptions and event handlers correctly wired? Is there a clear, single source of truth for price emission? Are there race conditions or duplicated emissions possible? Is backfill/poll logic stable? Is there a path for emiting priceUpdate on new Oracle prices and on new Oracle-trust updates?
- Database schema changes in db.js: Is ledger now UNIQUE or is there a safe unique index? Do we still avoid duplicates without losing legitimate data? Are inserts safe under concurrent writes? Is getGraphData robust to empty data sets?
- Public endpoints and client wiring: Does /graph return latestPrice and graphs data as expected by the UI? Are prices.js and utils.js correctly handling priceUpdate events and graph refreshes without overwriting live data?
- Logging and observability: Are price events logged with timestamp, ledger, and price? Are there any silent failures or unhandled rejections? Is there sufficient logging around retries and server cycling between XRPL servers?
- Tests and coverage: Propose unit or integration tests to cover
a) Dedup logic for ledger prices
b) Backfill price ingestion
c) Price emission via TrustSet and via oracle updates
d) Graph data correctness across periods

Acceptance criteria:
- Changes are clearly justified, with risk assessment and potential regressions identified.
- Suggestions for tests and mocks to cover price update flow.
- No breaking changes to existing UI workflows unless necessary and well-documented.