# Resonant Golf: notes for Claude

The app is named **Resonant Golf** inside the app (title, header) and **Resonant** on the home screen (`short_name`). Icon: a ball-flight arc rising into an orange target, on blue (#1d4e8c).

Personal installable web app (PWA) for one golfer, used on Android in Chrome. Hosted on GitHub Pages from `main`, at https://oscdec.github.io/Golf-App/. The owner is not a developer: explain in plain words, and never ask them to run commands.

## Structure
- `index.html`: app shell. Each tab is a `<main class="view" data-tab="...">`; bottom nav switches tabs by `#hash` (first part before `/`).
- `css/app.css`: all styles. Colors and fonts are tokens on `:root`, with dark-mode overrides.
- `js/store.js`: shared storage helpers (`Store`). All data keys start with `rg.` (plus Tempo's older `tempoFrames`).
- `js/handicap.js`: World Handicap System index estimate (`Handicap`); also loads in Node for testing.
- `js/backup.js`: backup/restore of every app key to a JSON file (`Backup`); panel lives in the Insights tab.
- `js/tempo.js`: Tempo tab, wrapped in its own function scope. Add each new tab as its own `js/<tab>.js`.
- `js/rounds.js`: Rounds tab. Screens are sub-routes of `#rounds/...` so the phone's back button works.
- `js/app.js`: tab switching, service worker registration, install button, persistent-storage request.
- `sw.js`: offline cache. App files are network-first, fonts cache-first.
- `manifest.webmanifest`, `icons/`: install metadata.

## Rules
- **Bump `VERSION` in `sw.js` on every release**, and add any new file to its `APP` list.
- No build step and no frameworks. Plain HTML, CSS and JS so the files deploy as-is.
- Use relative paths only (the site lives under `/Golf-App/`).
- Data goes in browser storage on the phone via `Store`, under `rg.` keys, so backup/restore picks it up automatically. Never store app data under other keys.
- Data keys: `rg.courses` (courses with tees: rating, slope, par[18], si[18]), `rg.rounds`, `rg.tags` (feel tags), `rg.pastScores` (GHIN differentials entered by hand), `rg.meta` (last backup time).
- Rounds decisions: blind scoring (no par, total or score-to-par while a round is in progress); per hole: shots to green, putts, penalties, D/T/115/DC taps; 3p, 5 and GIR+1 are derived; no fairways; best 3 shots is the last step; PCC added after from GHIN.
- Tempo's `render()` touches every `.chip` on the page; don't reuse that class name in other tabs.
- Tempo decisions: always 30 fps; ratio lock on by default; count-in gap = backswing + downswing frames; no rep counter; screen wake lock off by default.
- The project plan lives in the claude.ai Golf Game project (`claude/golf-app-plan.md`). Update it at the end of each session.
