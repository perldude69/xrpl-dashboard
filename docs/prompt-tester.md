XRP Price Update Issue - Reproduction Prompt for Tester

Overview:
You are the tester for the XRP price panel. Your objective is to reproduce the live price update issue observed in the UI, verify that updates appear correctly in both the summary (current price display) and the expanded graph, and report precise findings to help the team reproduce and fix the bug.

Environment setup:
- Run server locally: npm install (if not installed) then npm start (runs node index.js) on port 3000 by default.
- Ensure XRPL connection is possible in your environment or use a mocked XRPL if needed for repeated tests.
- Access the UI at http://localhost:3000/

What to verify:
1) Summary view price update: Confirm that the current price indicator (small price near graph, and any summary price) updates in real time when a new price emission occurs.
2) Expanded price graph: Open the XRP Price Graph panel and verify that the graph updates or reloads when a new price arrives, and that the latest price is reflected in the header.
3) Spikes, duplicates, or stale data: Watch for duplicate priceUpdate events or repeated prices; note timestamp, ledger, and price values to determine if duplicates are emitted.
4) Graph load failures: If loading the graph fails, capture error messages, HTTP request responses, and console errors for debugging.

Data to collect:
- Steps to reproduce (order of actions, UI interactions).
- Expected vs actual results for both the summary price and the expanded graph.
- Console/log messages (priceUpdate events, network requests, errors).
- Any observed race conditions or UI freezes.

Acceptance criteria:
- The summary price updates within 1-2 seconds of a price emission.
- The expanded graph loads and refreshes with each new price without crashing, and shows the latest price distinctly.
- No duplicate price emissions should cause wrong chart data or UI flicker.

Deliverables:
- A reproducible set of steps and a brief report of findings, including any needed follow-up steps for fixes.