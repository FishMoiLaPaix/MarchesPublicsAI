# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Cross-platform desktop app for searching French/European public procurement
notices ("marchés publics") across many sources, with AI relevance analysis.
Built on the **PersoIA addon skeleton**: **Quasar 2 + Vue 3 + TypeScript**,
packaged for desktop (Electron), with a mobile base (Capacitor) and web (PWA).
Part of the persoIA tool ecosystem (shared token). UI, comments, and commit
messages are in **French** — match that.

> The previous app was vanilla Electron (a single `main.js` + a 2771-line inline
> `index.html` + `preload.js`). It is archived under `legacy/` as the porting
> reference — do not ship from it.

## Commands

```bash
npm install
npm run dev                  # app web (Quasar dev)
npx quasar dev -m electron   # app desktop (dev, hot reload)
npm run lint                 # eslint (flat config) — must be 0 errors
npm run test                 # vitest (domain + shared unit/oracle tests)
npm run build                # SPA  → dist/spa
npm run build:pwa            # PWA  → dist/pwa
npm run build:electron       # DMG / NSIS / AppImage → dist/electron/Packaged
```

## Shipping = GitHub Releases (NOT push-to-main)

Distribution is via **packaged installers on GitHub Releases**, not raw-file
auto-update. The Jenkins pipeline (`ci/Jenkinsfile`) runs lint+test on every
branch and, on a **`v*` tag**, builds per-platform artifacts and uploads them to
the matching GitHub release. The app checks the latest release on launch
(`src/shared/persoia/updater.ts` + `components/UpdateBanner.vue`) and shows a
banner when a newer version exists. `updateRepo` (`FishMoiLaPaix/MarchesPublicsAI`)
lives in `addon.config.json`. Cut a release with `bash scripts/release.sh X.Y.Z`.

Still **never commit to `main` directly** — branch + PR (standard hygiene; a second
contributor pushes to `main`, so `git fetch` before any action).

## Architecture

Identity lives in **`addon.config.json`** (single source of truth: `name`,
`displayName`, `clientId` = `marchespublicsai` for the `X-Persoia-Client` header,
`appId` = `com.persoia.marchespublics`, `updateRepo`). `scripts/init-addon.sh`
seeds it; `quasar.config.ts` reads it for Electron/Capacitor build config.

Node vs renderer split (crucial — keep it):

- **`src-electron/`** — Electron MAIN process (Node). Everything needing
  `cheerio`/`axios`/`fs` or that bypasses CORS: source scraping, geo reference,
  the JSON store. Exposed to the renderer via the preload bridge.
  - `electron-main.ts` — window, IPC registration (`persoia:*` from the skeleton +
    `mp:*` for this app).
  - `electron-preload.ts` — exposes `window.persoia` (auth, skeleton) and
    `window.mp` (getSources / searchSource / getGeoReference / openUrl).
  - `sources/` — the 11 sources (`http.ts` axios helpers, `boamp.ts`, `ted.ts`,
    `place.ts` factory, `aggregators.ts`) + `index.ts` registry & dispatch.
  - `geo.ts` — geo reference from `geo.api.gouv.fr` (cache injected). `store.ts` —
    minimal `userData/store.json` (geo cache only).
- **`src/`** — RENDERER (Vue).
  - `shared/persoia/` — auth/token/client/updater, **copied verbatim from the
    skeleton — never fork it; re-sync from the skeleton on upstream changes**.
  - `shared/mp/types.ts` — shared domain types + `window.mp` interface.
  - `domain/` — pure TS, testable: `text.ts` (norm/stem/stopwords), `geo.ts`
    (`geoScan`), `scoring.ts` (`computeClientScore`), `dates.ts`, `filters.ts`
    (`buildFilters`, `offerKey`), `pipeline.ts` (`processResults`),
    `aiAnalysis.ts` (prompt + PersoiaClient call).
  - `stores/search.ts` — Pinia: state + orchestration (search, scoring, AI,
    filters, recents, trash). Persistence via Quasar LocalStorage.
  - `pages/SearchPage.vue` + `components/` (FilterBar, SourceList, PersoiaSidebar,
    ResultCard, AiPanel, RecentChips, TrashDialog) + `layouts/MainLayout.vue`.

### Sources (`src-electron/sources/`)

Each source is `{ id, name, country, description, url, search(query, offset, opts) }`.
`search` returns an array or `{ results, total }`; results normalize to
`{ title, desc, date, datelimite, procedure, depts, url }`. Mix of official JSON
APIs (BOAMP via Opendatasoft, TED v3) and `cheerio` HTML scraping. The renderer
calls each selected source via `window.mp.searchSource` (IPC) and concatenates
into `allResults`. To add a source: add a module and register it in
`sources/index.ts` — the UI (`mp:getSources`) picks it up. **Scraping must stay in
the main process (CORS/Node).**

### Search/relevance pipeline (`src/domain/pipeline.ts` `processResults`)

`allResults` → **hard filters** (trash/blacklist, publication & closing dates,
état, geographic zone, Services-only "prestation" filter) → **relevance split**:
keyword-mode matching (`strict`/`souple`/`ou`) + score > 0 separates pertinent from
non-pertinent (non-pertinent hidden by default). Local scoring `computeClientScore`:
keywords parsed into **groups** (a group matches only if *all* its words are present,
light FR stemming via `stemWord`); a geographic mismatch heavily penalizes the score.
The **prestation filter** uses the same group-AND-of-words matching (a prestation is
a service label like "nettoyage de locaux", not a literal substring). AI analysis
(`aiAnalysis.ts`) runs async after the first render and overrides local scores.

### AI provider — persoIA only

Single provider. Auth/token/client come from `src/shared/persoia` (skeleton):
one-time browser loopback login writes the key to the shared `config.env`, reused by
every persoIA tool. First launch auto-triggers login (`PersoiaSidebar`). The endpoint
is OpenAI-compatible (`PersoiaClient.chat`), requests carry `X-Persoia-Client`. The
analysis prompt is preserved verbatim in `domain/aiAnalysis.ts`; 503 (GPU starting)
triggers up to 4 retries (~40 s) in the store.

## Conventions

- Reuse shared text helpers (`norm`, `normWords`, `stemWord`, `STOPWORDS` in
  `src/domain/text.ts`) — never reinvent text matching.
- Unicode combining-marks regex must use the escaped form `[̀-ͯ]` (the
  literal form breaks on re-encoding).
- Facet changes that re-query a source (BOAMP) call `store.runSearch()`; purely
  client-side refinements rely on the reactive `processed` getter — don't refetch
  for something filterable in memory.
- Geo reference comes from `geo.api.gouv.fr` (cached) — no hardcoded department/
  region lists.
- Keep the Node/renderer split: no Node imports in `src/`; no DOM in `src-electron/`.
- Domain logic is pure and unit-tested (vitest, with oracles from the legacy app) —
  add tests when changing scoring/filters/sources.
