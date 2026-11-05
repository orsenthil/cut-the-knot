# Plan: finish the cut-the-knot port + build a remote MCP "tutor" server

## Context

The `web` branch of `orsenthil/cut-the-knot` (served by GitHub Pages at
https://orsenthil.github.io/cut-the-knot/) has 13 hand-ported games. `classes.zip`
holds about 1,297 applet archives, most of them geometry illustrations rather than games.
CLAUDE.md already defines a strict porting recipe, but there is no inventory, so nobody
knows what is left or which applets are worth porting first. The user also wants an MCP
server they can connect any AI client to, which acts as a tutor for the games and their
math and helps them understand and improve the port.

Decisions made: **games first, then everything else in batches**; the MCP server is
**remote HTTP**, written in **TypeScript/Node**.

Two tracks share one artefact, an **applet manifest**. It drives the porting work, and
the MCP server serves it.

---

## Track A: the porting campaign

### A1. Build the manifest (one commit, done locally)
- New `porting/manifest.json` with one entry per top-level `.zip`/`.jar` in `classes.zip`:
  `{ name, archive, kind: "game"|"demo"|"illustration"|"helper", priority, ctkUrl, slug|null, status: "todo"|"ported"|"skip", notes }`.
- New `porting/build-manifest.mjs` (Node, read-only on the zip): lists the archives with
  `unzip -Z1` and drops helper `.class` files (`CTK*`, `Doub*`, `banner*`). It marks the 13
  existing slugs as `ported` by matching `games.js` against the Java names
  (e.g. `CoinsGame` → `coins`, `chocolate` → `chocolate`).
- Classify `kind` and fill `ctkUrl` with a Claude pass that reads each applet's class names
  and strings (`javap -p`) and the matching cut-the-knot.org page. Commit the result so
  the cloud sessions inherit it.
- Add `porting/README.md` with the per-applet workflow:
  `unzip classes.zip 'classes/<Name>*' -d /tmp/x`, then follow the CLAUDE.md recipe, then
  set the manifest status to `ported`.
- Fix CLAUDE.md drift: it refers to a `classes/` directory, but only `classes.zip` is
  checked in. Say that clearly. Also give a Linux headless Chrome path (`chromium` /
  `google-chrome`) next to the macOS one, so cloud sessions can take screenshots.

### A2. Run the ports in parallel cloud sessions
- The order follows the manifest: all `kind: game` first, sorted by `priority`, then
  `demo`, then `illustration`.
- **No PRs: commits go straight to `web`**, one game per commit, but only after an
  automated gate passes. Every push goes live on GitHub Pages, so the gate takes the
  place of human review.
- New `porting/verify.sh <slug>` is the gate, and it must exit 0 before a commit:
  - `node --check` on every script in the folder.
  - `node porting/check-<slug>.mjs`, the port's own Node logic test, which is required
    for any game with a core.
  - `porting/lint-page.mjs` checks the page against CLAUDE.md: section order, two-line
    `#rules`, `#math` with 2–5 `<h3>`, the three `../assets` includes, `data-game`
    matching the folder, a `games.js` entry with ≤3 known tags, and `thumb.svg` with
    viewBox `0 0 320 200`.
  - A headless Chromium smoke test that loads the page in both themes at 375px. It fails
    on console errors or horizontal overflow and saves the screenshots for the session
    to look at.
  - The site-wide check: the home grid loads and every `games.js` slug has a folder.
- Each routine run follows this loop: `git pull --rebase` → pick `next_to_port` and mark
  it `in-progress` (pushed immediately as a claim, so parallel runs don't collide) →
  port → `verify.sh` → if it fails, fix and retry up to 3 times, then mark it `failed`
  with notes and move on → commit `Add <Game Name> puzzle` with the manifest set to
  `ported` → `pull --rebase` and push, retrying if the push is rejected.
- Prompt template (stored in `porting/README.md`): "Port the next applet from
  porting/manifest.json following CLAUDE.md and porting/README.md. Do not open a PR:
  pass porting/verify.sh, then commit and push directly to web."
- Geometry illustrations will dominate the later batches, so add a shared helper
  `assets/geom.js` once 2–3 of them have been ported by hand. It should cover draggable
  points on an SVG, lines, circles, intersections and redraw on drag, so it is extracted
  from real use rather than designed up front.
- **Articles:** for each port, the "Look for the math" section is a concise *original*
  explanation that links back to the cut-the-knot page, as the existing games already do.
  Do not copy Bogomolny's article text; it is still copyrighted. Standalone articles with
  no applet are a later batch, listed in the manifest as `kind: "article"`.

---

## Track B: the MCP tutor server (`mcp/`)

The MCP server does not do the teaching itself. The AI client's model teaches, and the
server supplies **grounded material, runnable game logic and teaching prompts**, so
answers come from this site's actual code and explanations rather than from memory.

### B1. Layout (self-contained; the site stays build-free)
```
mcp/
  package.json            # @modelcontextprotocol/sdk, zod, wrangler, typescript
  wrangler.toml           # Cloudflare Worker, free tier
  scripts/build-index.mjs # repo -> src/generated/content.json + cores.js
  src/index.ts            # Worker entry: Streamable HTTP transport at /mcp
  src/server.ts           # tool/resource/prompt registration
  src/generated/          # gitignored build output
```
- **Hosting:** GitHub Pages is static and cannot run an MCP endpoint, so use a Cloudflare
  Worker (stateless Streamable HTTP, e.g. `https://coolmaths-tutor.<acct>.workers.dev/mcp`).
- **Content index** (`build-index.mjs`, runs in CI): reads `assets/games.js` (evaluated the
  way CLAUDE.md shows), each `<slug>/index.html` (extracting `#rules`, the `#math` sections
  with their `<h3>` headings, wiki terms and the cut-the-knot link), `porting/manifest.json`
  and the core JS files. Output is JSON.
- **Runnable cores:** Workers forbid `eval`/`new Function`, so the build wraps each DOM-free
  core (`hourglass/hourglass-core.js` → `HourglassCore`, `coins/coin-game.js` →
  `Coin`/`CoinGame`) as an ES module (`<source>\nexport { HourglassCore };`) and bundles it.
  The cores stay untouched and stay the single source of truth.

### B2. What it exposes
**Resources:** `coolmaths://catalogue`, `coolmaths://game/{slug}` (rules + math + source),
`coolmaths://tag/{tag}`, `coolmaths://manifest`.

**Tools:**
- `list_games(tag?)`, `get_game(slug)`, `search(query)`: keyword search over titles,
  blurbs, math text and tags.
- `explain_concept(tag|term)`: every game that uses the concept, plus the relevant math
  paragraphs and Wikipedia link.
- `run_game_logic(slug, action, args)`: calls the real cores, e.g. hourglass `solve`, or
  the coin game's computer reply to a position. The tutor can then *show* a strategy
  instead of describing it.
- `porting_status(kind?)` / `next_to_port()`: reads the manifest, which helps when
  planning the campaign.
- `get_original(name)`: manifest entry, cut-the-knot URL, and the Java source when a
  `*_src/` exists. Useful for checking whether a port is faithful.

**Prompts:** `tutor(slug)` (Socratic: play first, then hints, then the invariant),
`quiz_me(tag)`, `explain_like_im(slug, level)`, `review_port(slug)` (compare the JS port
with the original rules and math and suggest improvements).

### B3. Deploy and connect
- `.github/workflows/mcp.yml`: on push to `web`, `npm ci && node scripts/build-index.mjs
  && wrangler deploy` in `mcp/`, using a `CLOUDFLARE_API_TOKEN` secret. Every merged port
  therefore updates the tutor automatically.
- The server is read-only and public, so start without auth. Add a bearer-token check in
  `index.ts` later if needed.
- Connect: Claude Code `claude mcp add --transport http coolmaths https://…/mcp`;
  claude.ai / Desktop via Settings → Connectors → add custom connector URL.

---

## Where each part runs

| Part | Runs in | Automatic? |
|---|---|---|
| One-time: Cloudflare account, `CLOUDFLARE_API_TOKEN` repo secret, cloud env network allowlist for cut-the-knot.org / en.wikipedia.org | You, in browsers | No, about 10 minutes, once |
| A1 manifest + verify gate + B1–B3 MCP server | **One cloud session** (`claude --remote`), commits straight to `web` | Yes |
| MCP deploy | GitHub Actions on every push to `web` | Yes |
| A2 ports | **Scheduled cloud routines** (`/schedule`): each run ports, verifies and pushes 1–3 applets directly to `web` | Yes, on a cron |
| Monitoring | `porting_status()` on the MCP server, or the manifest's `failed` entries | Read when you like |

To spend the credits faster, create several routines (for example 3–4, each on an hourly
cron). The manifest claim plus rebase-and-retry lets them run at the same time safely.
Pause or delete them once `next_to_port()` comes back empty.

One-time check before starting: confirm the cloud environment is allowed to push to
`web` (some setups only allow pushing to the session's own branch), and that Chromium is
available or installable there for the smoke test.

**Fallback if cloud sessions can't push to `web`:** add `.github/workflows/automerge.yml`.
On push to any `claude/**` branch it runs `porting/verify.sh` in CI on the changed game,
and if that passes it fast-forwards (or rebases and pushes) `web` and deletes the branch.
This stays fully automatic with no PRs.

## Kick-off (step 0, local, right after approval)
- Copy this plan into the repo as `porting/PLAN.md`, commit it to `web` and push. Cloud
  sessions can't see `~/.claude/plans`, and the routine prompts point at this file.
- Also in that commit: the CLAUDE.md fixes from A1 (`classes.zip` note, Linux Chromium path).

## Order of work
1. A1 manifest + CLAUDE.md fixes (local).
2. B1–B3 MCP server against the current 13 games (local, then deploy).
3. A2 campaign run by the routines with no one stepping in. The tutor redeploys with every
   push, and its `review_port` / `get_original` tools let you spot-check ports afterwards.

## Verification
- Manifest: `node porting/build-manifest.mjs` is idempotent; every `games.js` slug maps
  to a `ported` entry; the counts by kind look sensible.
- MCP: `npx wrangler dev` locally, then `npx @modelcontextprotocol/inspector` against
  `http://localhost:8787/mcp`. List the tools, call `get_game("hourglass")`, and check that
  `run_game_logic("hourglass","solve",…)` gives the same answer as the Node one-liner in
  CLAUDE.md.
- After deploy: `claude mcp add` the workers.dev URL and have a real tutoring session on
  one game.
- Each port: `porting/verify.sh <slug>` must pass before the commit. This automates the
  CLAUDE.md §6 checklist, and the session plays through to a win and a loss in Node.
- Gate self-test: run `verify.sh` on all 13 existing games first. All must pass, so the
  gate is not stricter than the hand-made reference ports.
