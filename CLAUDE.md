# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Electron desktop app (Windows-first) for searching French/European public procurement notices ("marchés publics") across many sources, with AI relevance analysis. UI, comments, and commit messages are in **French** — match that.

## Commands

- **Run in dev:** `npm start` (alias for `electron .`) — there is no bundling/transpile step; the app runs directly from the source files.
- **Build a portable Windows .exe:** `npm run build` (`electron-builder --win --x64`, output in `dist/`).
- **End-user install:** `INSTALLER.ps1` (downloads Electron, copies app to `%LOCALAPPDATA%\MarchesPublicsAI`, makes a desktop shortcut). `UNINSTALL.ps1` reverses it.
- **No test runner and no linter are configured.** To sanity-check the renderer (all logic lives in one inline `<script>` in `index.html`), extract it and syntax-check with Node:
  ```bash
  # PowerShell: read as UTF-8 (the file has a unicode regex that breaks naive re-encoding)
  $h=[IO.File]::ReadAllText("$PWD\index.html",[Text.Encoding]::UTF8)
  $code=[regex]::Match($h,'(?s)<script>(.*?)</script>').Groups[1].Value
  [IO.File]::WriteAllText("$env:TEMP\c.js",$code,(New-Object Text.UTF8Encoding($false))); node --check "$env:TEMP\c.js"
  ```
  `main.js` and `preload.js` are plain Node — check with `node --check`.

## Shipping = pushing to `main`

The app **auto-updates from GitHub raw files**, not from releases. `main.js` defines `UPDATE_REPO` (`FishMoiLaPaix/MarchesPublicsAI`) and `UPDATE_FILES` (`main.js`, `preload.js`, `index.html`, `package.json`). On launch the app compares the latest commit on `main` to the one it has applied and re-downloads those four files if they differ. **Therefore: committing and pushing to `main` ships an update to all installed copies.** The distributed unit is the source itself — there is no compiled artifact in the update path. GitHub Releases are only a convenience ZIP for new installs.

## Architecture

Three files are the whole app (everything else is install/docs):

- **`main.js`** — Electron main process. Window creation, IPC handlers, and all privileged/network work: source scraping, AI calls, GitHub auto-update, persoIA auth, geo reference. Two unrelated persistence layers live here:
  - the app store: `store.json` in Electron `userData` (`loadStore`/`saveStore`, exposed to the renderer as `store-get`/`store-set`).
  - the persoIA shared store: `%APPDATA%\persoia\config.env` (see persoIA below) — a separate file shared with other persoIA tools.
- **`preload.js`** — the only bridge. `contextIsolation` is on and `nodeIntegration` off, so the renderer can only do what `window.api.*` exposes here (each method is an `ipcRenderer.invoke`). Adding a renderer→main capability means adding it in both `preload.js` and `main.js`.
- **`index.html`** — the **entire renderer**: all CSS and all client JS inline in one `<script>` (~2400 lines). UI, search orchestration, filtering, local relevance scoring, pagination, persoIA UI, trash/read state all live here. "Edit the UI/logic" almost always means editing this file.

### Sources (`main.js` `SOURCES` array)

Each source is `{ id, name, country, description, url, search(query, offset, opts) }`. `search` returns either an array or `{ results, total }`; results are normalized to `{ title, desc, date, datelimite, procedure, depts, url }`. Sources mix **official JSON APIs** (e.g. BOAMP via Opendatasoft, TED) and **HTML scraping with `cheerio`**. The renderer fetches each selected source via the `search-source` IPC and concatenates into `allResults`. To add a source, append to `SOURCES` — the UI (`get-sources`) picks it up automatically.

### Search/relevance pipeline (`index.html` `getProcessedResults`)

`allResults` → **hard filters** (trash/blacklist, publication & closing dates, état, geographic zone, and the Services-only "prestation" filter) → **relevance split**: keyword-mode matching (`strict` / `souple` / `ou`) plus score-> 0 separates **pertinent** from **non-pertinent** results. By default only pertinent show; a button reveals the non-pertinent ones. Local scoring is `computeClientScore`: keywords are parsed into **groups** (a group matches only if *all* its words are present, with light FR stemming via `stemWord`); geographic mismatch (using the geo reference) heavily penalizes score. The **prestation filter** uses the same group-AND-of-words matching (a prestation is a service label like "nettoyage de locaux", not a literal substring). AI analysis (`analyze-with-ai`) runs asynchronously after the initial render and re-scores via `aiAnalysis`, which overrides local scores when present.

### AI provider — persoIA only

The UI exposes a single AI provider, **persoIA**. `callAI` in `main.js` still contains other providers (anthropic/openai/mistral/ollama/custom) but they are no longer reachable from the UI. persoIA uses a **Node port of [`persoia-auth`](https://github.com/FishMoiLaPaix/persoia-auth)**: a one-time **browser loopback login** (ephemeral `127.0.0.1` server, anti-CSRF `state`, CORS limited to the persoIA portal) that writes the key to the shared `config.env`; the key is then read back automatically and reused by every persoIA tool. On first launch, if no config exists, the app auto-triggers this login (`ensurePersoiaConfig`). The persoIA endpoint is OpenAI-compatible; requests carry an `X-Persoia-Client` header.

## Conventions

- Keep relevance/matching logic consistent: reuse the shared helpers (`norm`, `normWords`, `stemWord`, `STOPWORDS`) rather than reinventing text matching.
- Filters that re-query a source (BOAMP facets) call `triggerSearch`; purely client-side refinements call `refreshResults`. Don't refetch for something filterable in memory.
- The geo reference comes from `geo.api.gouv.fr` (cached) — no hardcoded department/region lists.
