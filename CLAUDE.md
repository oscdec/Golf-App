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
- `js/rounds.js`: Rounds tab. Screens are sub-routes of `#rounds/...` so the phone's back button works. Exposes `Rounds.index()`.
- `js/notes.js`: Notes tab (`Notes`): seven boxes (General, Mental, Driver, Irons, Wedges, Chipping, Putting). Update archives the text (last 5 kept) and clears the box, with Undo; Previous notes lists them. `Notes.get(area)` is used by practice sessions.
- `js/sessions.js`: the suggested week and the session runner (`Sessions`): week card on the Practice home, `#practice/s/<id>` (start alone, move to another day, mark done), `#practice/run` (block countdown, practiced, left in session, pause/skip/end, games launch from the block, matching notes), `#practice/sum/<runId>`. A clock bar shows on other Practice screens while a session runs.
- `js/practice.js`: Practice tab (week plan from `Sessions`, then Games grouped by discipline). Each game = setup + a log of inputs; progress and results are worked out by replaying the log, so Undo just pops it. Sub-routes of `#practice/...`.
- `js/insights.js`: Insights charts (handicap index, scores with 12-round rolling average, Tiger 6 mistakes per round with a type picker and per-type averages, penalty strokes per round, GIR+1 per round, scoring by par type, scoring mix per round; the per-round trend charts show dots plus a 12-round rolling average) with a range filter (last 10/20/40 rounds, or 3 months to all; for the handicap chart, "last N" means the last N scores including past GHIN scores), tap tooltips and "Show numbers" tables. Hand-built SVG; reads `Rounds.history()` and `Rounds.list()` (each round has `t6` per type, `t6total`, `pen`, `gir1`).
- `js/app.js`: tab switching, service worker registration, install button, persistent-storage request.
- `sw.js`: offline cache. App files are network-first, fonts cache-first.
- `manifest.webmanifest`, `icons/`: install metadata.

## Rules
- **Bump `VERSION` in `sw.js` on every release**, and add any new file to its `APP` list.
- No build step and no frameworks. Plain HTML, CSS and JS so the files deploy as-is.
- Use relative paths only (the site lives under `/Golf-App/`).
- Data goes in browser storage on the phone via `Store`, under `rg.` keys, so backup/restore picks it up automatically. Never store app data under other keys.
- Data keys: `rg.courses` (courses with tees: rating, slope, par[18], si[18]), `rg.rounds`, `rg.tags` (feel tags), `rg.pastScores` (GHIN differentials entered by hand), `rg.meta` (last backup time), `rg.games` (practice games: game, variant, setup, log, status active/done/failed, result), `rg.insightsRange` (chosen date range), `rg.notes` ({cur, edited, hist}), `rg.plan` (usual week), `rg.week` (this week: days per slot, done per session; resets each Monday), `rg.run` (session in progress), `rg.practiceLog` (minutes per block: date, session, discipline, done, games), `rg.settings` (normal driver carry).
- Rounds decisions: blind scoring (no par, total or score-to-par while a round is in progress); per hole: shots to green, putts, penalties, D/T/115/DC taps; 3p, 5 and GIR+1 are derived; no fairways; best 3 shots is the last step; PCC added after from GHIN.
- Games: Beat Your Average = mean of the last 12 finished games of the same variant (e.g. ladder-irons-hard); failed Lag Putt games are left out. Each game is higher- or lower-is-better.
- Chart colors are tokens `--s1`..`--s4` (validated categorical palette, light and dark); keep series in that fixed order and keep direct labels + the numbers table, since two light-mode colors are under 3:1 contrast.
- The app opens on the Practice tab. Tab order: Practice, Rounds, Notes, Tempo, Insights (five tabs).
- Week plan: slots Mon–Fri plus one Weekend slot (Sat or Sun). Sessions are units (60 or 30 min); a 30-minute session can be moved alone, splitting it from its partner. Done sessions/days are highlighted. Default week: Tue Technical Ball Striking (pick Center Strike / Startline or Face Control / Tempo when starting); Wed Technical Chipping + Technical Putting; Thu Ball-Striking Combine + Wedge Combine; Fri Chipping game + Putting game; Weekend Wedge session. Routines live in `ROUTINES` in sessions.js: steps with minutes, drills, prompts and tap counters (tally rows, optional pass mark), each step with its own countdown; results are saved in `rg.practiceLog` (`routine`, `results`). Center Strike / Startline comes from Dane Cvetkovic's one-hour range routine Short (the 10-min warm-up is our addition). Face Control / Tempo, Technical Chipping and Technical Putting are placeholders until the owner supplies them.
- Benchmark games: Ball-Striking Combine and Wedge Combine (SkyTrak carry + offline → feet from target; result = handicap the proximity plays like, Shot Scope bands), Chipping Combine (zone taps → average leave in feet; no putting), Up-and-Down 18 (strokes vs shots-to-finish × 18), SkyTrak Combine (log only). 10-handicap short-game numbers are interpolated and labeled est.
- `const` globals (Notes, Sessions, Store) are not on `window`; check them with `typeof`, not `window.X`.
- Tempo's `render()` touches every `.chip` on the page; don't reuse that class name in other tabs.
- Tempo decisions: always 30 fps; ratio lock on by default; count-in gap = backswing + downswing frames; no rep counter; screen wake lock off by default.
- The project plan lives in the claude.ai Golf Game project (`claude/golf-app-plan.md`). Update it at the end of each session.
