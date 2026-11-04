# Resonant Golf: notes for Claude

The app is named **Resonant Golf** inside the app (title, header) and **Resonant** on the home screen (`short_name`). Icon: a ball-flight arc rising into an orange target, on blue (#1d4e8c).

Personal installable web app (PWA) for one golfer, used on Android in Chrome. Hosted on GitHub Pages from `main`, at https://oscdec.github.io/Golf-App/. The owner is not a developer: explain in plain words, and never ask them to run commands.

## Structure
- `index.html`: app shell. Each tab is a `<main class="view" data-tab="...">`; bottom nav switches tabs by `#hash`.
- `css/app.css`: all styles. Colors and fonts are tokens on `:root`, with dark-mode overrides.
- `js/tempo.js`: Tempo tab, wrapped in its own function scope. Add each new tab as its own `js/<tab>.js`.
- `js/app.js`: tab switching, service worker registration, install button, persistent-storage request.
- `sw.js`: offline cache. App files are network-first, fonts cache-first.
- `manifest.webmanifest`, `icons/`: install metadata.

## Rules
- **Bump `VERSION` in `sw.js` on every release**, and add any new file to its `APP` list.
- No build step and no frameworks. Plain HTML, CSS and JS so the files deploy as-is.
- Use relative paths only (the site lives under `/Golf-App/`).
- Data goes in browser storage on the phone. Every new kind of data must be included in backup/restore once that exists.
- Tempo decisions: always 30 fps; ratio lock on by default; count-in gap = backswing + downswing frames; no rep counter; screen wake lock off by default.
- The project plan lives in the claude.ai Golf Game project (`claude/golf-app-plan.md`). Update it at the end of each session.
