 XRP Price Update Flow - Code Review and Fix Prompt for Coder

Objective:
Review the price update flow across the server and client layers (xrpl.js, index.js, public/prices.js, public/utils.js) to identify causes of stale or duplicate price emissions and issues loading the expanded price graph. Propose and implement fixes, then validate with a local run.

Anti-Loop Directive:
To prevent the agent from getting caught in loops, ensure that:
- Any code loops have proper exit conditions and are bounded (e.g., use timeouts, iteration limits).
- In reasoning and implementation, avoid repetitive actions without progress; if stuck, escalate to @reviewer or @tester.
- Monitor for infinite recursion or unbounded iterations in algorithms.

What to review in code:
- xrpl.js: Connection lifecycle, subscriptions to ledger and transactions, real-time price emission logic on TrustSet from ORACLE_ACCOUNT, deduplication logic and emission of priceUpdate events.
- index.js: Graph API endpoint that serves data for the price graph; how latest price is included in the response; how graph data is constructed from the xrp_price table.
- public/prices.js: Graph date/price loading logic and UI wiring; how /graph is invoked and how data is consumed by Chart.js.
- public/utils.js: Client-side price update handling; ensure consistent UI update when priceUpdate events arrive, and syncing with the graph data refresh.

Key issues to consider:
- Potential syntax issues in xrpl.js that could lead to mis-scoped event handlers or unreachable code segments (look for brace mismatches and proper chaining of promises).
- Duplicates: There is an INSERT OR IGNORE with a ledger field that may not be constrained as UNIQUE, causing duplicates if the same ledger is inserted twice.
- Graph loading: Ensure the graph endpoint returns a consistent latest price value and that the client correctly refreshes the chart on updates.
- Race conditions: Ensure that price updates and graph data fetches do not race, causing stale data to appear in either view.

Proposed fixes (high-level):
1) XRPL price emission flow:
- Correct braces and promise chaining in xrpl.js to ensure ledger subscription, tx listener, and price emission are executed in a predictable order.
- Guarantee a single source of truth for lastEmittedPrice and lastRealTimePriceEmit with proper synchronization.
- Emit priceUpdate on both real-time transactions and successful oracle price updates when a new price is recognized, with de-dup logic.

2) Database schema and ingestion:
- Make ledger column UNIQUE (or add a UNIQUE index) so INSERT OR IGNORE prevents duplicates.
- Preserve the latest price per ledger timestamp to avoid duplicates in graph data.

3) Graph endpoint consistency:
- Ensure getGraphData always returns a latestPrice value and that the response shape matches what the frontend expects (labels, prices, latestPrice).
- Ensure safe handling when no data is available for the requested period.

4) Client-side wiring:
- Confirm that priceUpdate events are bound early after socket connection and that loadGraph does not overwrite the live price display.
- Ensure graph refresh button and panel opening load correctly without race conditions.

Local verification plan:
- Start server and observe console logs for connection status and price emissions.
- Trigger a price emission (simulate TrustSet from Oracle if possible) and verify:
  - priceUpdate event is received and UI updates the summary price.
  - Expanded graph updates with the new price, and chart data reflects the latest value.
- Run the backfill and poll mechanisms to ensure no regressions.

Deliverables:
- Patch diffs or code snippets for the four files with explanations of why changes fix the issues.
- A short local-run checklist with steps to reproduce the issue and to validate fixes.