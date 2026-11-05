# Porting workflow

This folder holds the inventory, the tools and the automated gate for porting the
cut-the-knot applets. The rules a port must follow (faithfulness, page format, look
and feel) are in [../CLAUDE.md](../CLAUDE.md); this file is the mechanics. Status and
history are in [PLAN.md](PLAN.md).

## Files

| File | What it is |
|---|---|
| `manifest.json` | Generated inventory: one entry per applet, with `kind`, `priority`, `ctkUrl`, `slug` and `status`. |
| `build-manifest.mjs` | Rebuilds the manifest from `classes.zip`. `--check` fails if the checked-in copy is stale, or if `overrides.json` repeats a key. |
| `overrides.json` | Hand-checked corrections (kind, status, ctkUrl, notes). Always wins. One entry per applet. |
| `ctk-urls.json`, `fetch-ctk-urls.mjs` | Applet name → cut-the-knot page, matched against the site's sitemap. |
| `disasm.mjs` | Compact bytecode of one applet: fields, strings, static tables, methods without the noise. |
| `page.mjs` | A cut-the-knot page as plain text, and which applets it embeds. |
| `play.mjs`, `play/<slug>.mjs` | Plays a page in headless Chromium from a short scenario; one combined screenshot. |
| `verify.sh` | The gate. Must exit 0 before a port is committed. |
| `lint-page.mjs`, `smoke-test.mjs` | Gate steps: the page against CLAUDE.md, and a headless load in both themes. |
| `check-<slug>.mjs` | Each port's Node logic test. |
| `lib/` | `load-core.mjs` (load a core, tiny test harness), `browser.mjs` (static server, Chromium), `archives.mjs`. |

## Setup (once per machine)

- **Playwright, globally** (the repo has no `node_modules`), without its browser
  download if a Chromium is already installed:
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -g playwright`. Run the browser tools with
  `NODE_PATH=$(npm root -g)`.
- **javap**: any JDK on PATH, or `mise exec java@temurin-21 -- javap`, which
  `disasm.mjs` falls back to by itself.
- **ImageMagick** (`magick`) is optional; with it `play.mjs` joins its screenshots.

## One porting step

This is the whole routine for a scheduled or hand-run step. Do exactly one applet.

1. **Sync.** `git pull --rebase`. If SSH hangs or fails (`timeout 20 git fetch -q
   origin`), use HTTPS for this session only, without touching git config:

   ```sh
   G() { git -c credential.helper= -c 'credential.helper=!gh auth git-credential' "$@"; }
   G pull --rebase https://github.com/orsenthil/cut-the-knot.git web
   G push https://github.com/orsenthil/cut-the-knot.git HEAD:web
   git update-ref refs/remotes/origin/web HEAD
   ```

   Then, if `web` has a commit from anyone else in the last 30 minutes
   (`git log --since='30 minutes ago' origin/web`), another porter is active: report
   that and stop this step.

2. **Pick the applet.** The first `todo` in manifest order (games, then demos, then
   illustrations). When several sessions port at once, claim it first: set
   `"status": "in-progress"` in `overrides.json`, commit and push that alone. A single
   porter needs no claim. Claims older than 30 minutes with no folder are stale: remove
   them and rebuild the manifest.

   ```sh
   node -e 'const m=require("./porting/manifest.json");
   const a=m.applets.find(x=>x.status==="todo"); console.log(a.name, a.kind, a.ctkUrl)'
   ```

3. **Check it isn't done already.** `ls -d *<word>*` and grep `assets/games.js` and
   `overrides.json`: a sibling port may already cover it (FrogsAndToads2D's page also
   described the 1-D puzzle; it still needed its own page).

4. **Read the original**, cheaply:

   ```sh
   node porting/page.mjs <Name>             # the rules and the claims; check "applets on page"
   node porting/disasm.mjs <Name>           # the whole applet, compact
   node porting/disasm.mjs <Name> --method Solve   # one method, when the summary is long
   ```

   If `page.mjs` says the page embeds no applet, the manifest URL is wrong (it once
   pointed `hanoi` at a reader's letter). Use `--links`, or the related-pages list, to
   find the applet's real page, and put it in `overrides.json` as `ctkUrl`.

5. **Decide what to port** (CLAUDE.md §1 has the rules): faithful by default; the page's
   stated puzzle wins over leftovers the applet copied from a sibling; harmless quirks
   stay; third-party code with all rights reserved is not transcribed.

6. **Write the core and its test first** (`<slug>/<slug>-core.js`,
   `porting/check-<slug>.mjs`), then the page. Copy the closest reference port (below).

7. **Register.** `assets/games.js` entry, `thumb.svg`, the slug in `SLUG_TO_APPLET` in
   `build-manifest.mjs`, and an `overrides.json` entry with `"status": "ported"` and a
   one-line note (what was ported, any deliberate change). Then
   `node porting/build-manifest.mjs`.

8. **Verify.** `NODE_PATH=$(npm root -g) porting/verify.sh <slug>`, then write
   `porting/play/<slug>.mjs` (a win and a loss or dead end) and run
   `node porting/play.mjs <slug>`; read the one combined screenshot. Up to three fix
   attempts; after that set `"status": "failed"` with a one-line reason, commit, move on.

9. **Commit and push** to `web`, no PR: one game per commit, titled
   `Add <Game Name> puzzle`, body as CLAUDE.md §6 says. `pull --rebase` and retry if the
   push is rejected.

## Closest reference port

Start from the existing port that already solved your UI problem:

| The applet is | Copy |
|---|---|
| disks on pegs | `hanoi` (one colour), `hanoi-3c` (colours, equal sizes stack), `bicolor-hanoi` |
| heaps or bars, played against the computer | `grundy` (SVG bars, cut points), `dawsons-kayles` (a ring) |
| a row of pieces that slide and jump | `frogs-toads`, `frogs-toads-2d` (grid) |
| a board game against an AI | `hex7` (hex grid, roving focus, computer on a timer) |
| a quiz with a score | `whats-next`, `maths-quiz` |
| a solver you can watch | `hourglass`, `hanoi` (Slow/Fast), `hanoi-3c` (Stop, One step) |
| coins or chips you click | `coins`, `flipthem` |

## The logic test

Each `check-<slug>.mjs` uses `lib/load-core.mjs` and, where it applies, has these
sections. Together they catch both porting mistakes and wrong claims.

1. **The core against the applet.** Transcribe the applet's method a second time, as
   close to the bytecode as you can (its loops, its fix-ups, its odd orderings), and
   compare it with the core over the **whole** parameter space or every reachable
   position, not a few samples.
2. **The page's claims, exhaustively.** Formulas, minimum move counts, "the computer
   always wins", "there are exactly two solutions": search every case the board sizes
   allow (BFS, game-tree search, enumeration). When a claim fails, the test asserts what
   is actually true, and the math section says so.
3. **The rules' edge cases**, and the end of the game: win, loss or dead end, and the
   applet's own messages.

Write numbers you have not computed yet as a placeholder, run the test, read what it
prints, then pin them. Several first failures were the test's own guesses (an
off-by-one partition count, a position where two cells win, a thumbnail showing an
illegal hop), not the port's.

## What `kind` means

| kind | Meaning | Count |
|---|---|---|
| `game` | Interactive puzzle or game with a win condition or an opponent. | 100 |
| `demo` | Interactive demonstration or calculator; nothing to win. | 218 |
| `illustration` | A theorem diagram, usually with draggable points. | 931 |
| `helper` | Shared library or page chrome. Not an applet, never ported. | 39 |

The classification comes from the applet's own class names and the section of
cut-the-knot.org its page sits in (see the top of `build-manifest.mjs`). It is a
starting order, not a verdict: when a port finds its applet misfiled, the fix goes in
`overrides.json` in the same commit. About 170 applets have no `ctkUrl`; finding the
page is part of porting one of those.

## The gate

`verify.sh <slug>` runs, in order:

1. `node --check` on every `.js` in the game folder.
2. `porting/check-<slug>.mjs`. Required for any game with a core.
3. `lint-page.mjs`: section order, the two-line `#rules`, `#math` with 2–5 `<h3>`, the
   three `../assets/` includes, `data-game` matching the folder, a `games.js` entry with
   at most 3 known tags, and a `thumb.svg` with viewBox `0 0 320 200`.
4. `smoke-test.mjs`: 375px and desktop, light and dark; fails on a console error, a
   failed request or horizontal overflow. Screenshots in `/tmp/coolmaths-smoke/<slug>/`.
5. The manifest is current, and every `games.js` slug has a folder.

`porting/verify.sh --all` runs it over every game.
