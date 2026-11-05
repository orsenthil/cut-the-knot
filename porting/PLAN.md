# Porting campaign: status and plan

Two goals: port every cut-the-knot applet worth porting to a game page on this site,
and run an MCP server that tutors from the site's own content. How to port one applet is
in [README.md](README.md); the rules a port follows are in [../CLAUDE.md](../CLAUDE.md).

## Where things stand (November 2026)

- **Inventory:** `porting/manifest.json` lists all 1,288 applets in `classes.zip`:
  100 games, 218 demos, 931 illustrations and 39 helper libraries (never ported).
  Run `node porting/build-manifest.mjs` for the current counts by status.
- **Ports:** 38 done. The 13 hand-made originals; about 20 from a parallel cloud run on
  2026-11-05 (six lanes, which ended when the credits ran out); then one an hour from a
  local loop.
- **Gate:** `porting/verify.sh` stands in for review. Every push to `web` goes live on
  GitHub Pages and there are no pull requests.
- **MCP tutor:** `mcp/`, a Cloudflare Worker at
  `https://coolmaths-tutor.orsenthil.workers.dev/mcp`. `.github/workflows/mcp.yml`
  rebuilds and redeploys it on every push to `web` that touches a game, so it always
  serves the current site. It exposes the catalogue, each game's rules and math, the
  runnable cores, the manifest (`porting_status`, `next_to_port`) and tutoring prompts.

## How porting runs now

One porter, locally, one applet per step, committing straight to `web`:

- Claude Code's `/loop` (or a cron job in a session) runs
  "Do one porting step per porting/README.md" every hour. The step is written out in
  full in the README, including the SSH-to-HTTPS fallback, so the prompt stays short.
- Each step skips itself if `web` has a commit from someone else in the last 30
  minutes (another porter is active), and releases claims older than that first.
- Several porters at once (cloud lanes) must claim the applet before starting, by
  pushing an `in-progress` status in `overrides.json`; otherwise they collide (two
  lanes once ported Bicolor Hanoi twice).

## Order of work

1. **Games** (`kind: "game"`, 62 left), in manifest order. Most are classic
   combinatorial games and puzzles; they follow the closest reference port.
2. **Demos.** Interactive demonstrations with nothing to win. Same page format, with the
   "Game:" line describing what to explore.
3. **Illustrations** (931, mostly geometry with draggable points). Before the first batch,
   port two or three by hand and extract a shared `assets/geom.js` from them (draggable
   points on an SVG, lines, circles, intersections, redraw on drag), so later ports are
   short.
4. **Articles** without an applet, last, listed in the manifest as `kind: "article"`.
   The "Look for the math" text is always an original, concise explanation that links
   to the cut-the-knot page; Bogomolny's article text is not copied.

## Lessons so far

- Applets copy code from their siblings and keep its leftovers; check the page's
  stated puzzle against the bytecode (CLAUDE.md §1).
- The cut-the-knot pages are sometimes wrong in small ways. Exhaustive checks corrected
  claims in Toads and Frogs (solution counts, palindromes) and 3-Colour Hanoi (which peg
  orders work), and settled open questions in What's Next? and 3-Colour Hanoi. The math
  sections say so.
- The manifest's page URLs come from a sitemap name match and are occasionally wrong;
  `porting/page.mjs` shows whether a page embeds the applet.
- Not every applet is Bogomolny's: Hex7 is Robert Kirkland's, all rights reserved, so
  only its rules were ported.
