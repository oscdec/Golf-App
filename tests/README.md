# Browser tests (for Claude, not part of the app)

Playwright scripts that drive the app in headless Chromium against a local server.

1. From the repo root: `python3 -m http.server 8765` (keep it running).
2. Run each script: `python3 tests/test_app.py` (and test_routine, test_round3, test_round4, test_alarm, test_insights).
   In Claude's cloud sandbox set `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` first.

Each prints PASS/FAIL lines and "no script errors". Font load failures (ERR_TUNNEL_CONNECTION_FAILED) are the sandbox blocking Google Fonts and can be ignored.
Sessions start with a check-in, so tests answer it with the `ci(pg)` helper.
