# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**coolmaths** is a static website of browser ports of Alexander Bogomolny's cut-the-knot.org Java applet puzzles, plus an arithmetic quiz (`maths-quiz/`). It uses plain HTML, CSS and vanilla JS: no build step, no package manager, no framework. The web work lives on the `web` branch. `master` holds the original upload.

`classes.zip` holds the original applets (about 1,300 `.jar`/`.zip` archives under `classes/`). Only the zip is checked in: extract what you need with `unzip classes.zip 'classes/<Name>*' -d <scratch dir>`. Decompiled or extracted Java sources (`*_src/`, e.g. `classes/RFWH_src/`) were made locally for some earlier ports and are not in the repo. The applets are reference material for porting and are not part of the site. Ports aim to reproduce the original behaviour exactly (e.g. `coins/coin-game.js` mirrors `CoinGame.java`'s strategy). `porting/manifest.json` lists every applet with its porting status, and `porting/PLAN.md` describes the porting campaign.

Players have a record of what they have played (`assets/progress.js`, shown on `profile/`), and an MCP server in `mcp/` serves the site as tutoring material. How those parts meet is written down in `docs/contracts.md`; the remaining work on accounts and sign-in is a queue of self-contained tasks in `tasks/` (`node tasks/next.mjs` lists what can be started; `tasks/README.md` has the routine).

`xscreensaver/` similarly holds reference sources for XScreenSaver hacks (e.g. `xscreensaver/hacks/euler2d.c`, ported to `euler2d/`) and is not part of the site either. XScreenSaver's own [screenshot gallery](https://www.jwz.org/xscreensaver/screenshots/) is a good place to find more of its math-flavored demos worth porting.

## Running and checking

```sh
python3 -m http.server 8000      # then open http://localhost:8000/ (tag filter: /#parity)
node --check path/to/file.js     # syntax check; there is no linter or test runner
```

Pure-logic modules have no DOM and no `module.exports`: `hourglass/hourglass-core.js` defines the global `HourglassCore`, and `coins/coin-game.js` defines the `Coin`/`CoinGame` classes. To exercise one in Node, evaluate the file and pull out the global:

```sh
node -e 'const src=require("fs").readFileSync("hourglass/hourglass-core.js","utf8");
const H=new Function(src+"; return HourglassCore;")(); console.log(H.solve)'
```

The site-wide pieces have their own checks: `node porting/check-concepts.mjs` (concept graph and recommender), `node porting/check-progress.mjs` (the tracker) and `NODE_PATH=$(npm root -g) node porting/check-profile-ui.mjs` (tracker, profile and home page in a browser). The MCP server: `cd mcp && npm ci && npm run build-index && npm test`.

For porting there are tools in `porting/` (see `porting/README.md`): `disasm.mjs <Applet>` prints an applet's bytecode compactly, `page.mjs <Applet|url>` prints its cut-the-knot page as text, `verify.sh <slug>` is the gate every port must pass, and `play.mjs <slug>` plays a page from a short scenario and joins the light and dark screenshots into one image. Run the browser tools with `NODE_PATH=$(npm root -g)` (Playwright is installed globally).

To check a page by hand without Playwright, use headless Chrome (`chromium`/`google-chrome` on Linux, `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS; `--no-sandbox` in containers): `<chrome> --headless=new --screenshot=... --window-size=W,H URL`, plus `--force-dark-mode` for dark. Its window is at least 500px wide, so phone width needs a 375px `<iframe>`; run it with a kill timeout, since dark mode can hang after the screenshot; pages with a `requestAnimationFrame` loop (hourglass) need `--timeout=` rather than `--virtual-time-budget=`. In cloud sessions `curl` can't reach `localhost`, but browsers and Python can.

## Architecture

Each game is a folder `<slug>/` containing `index.html`, its script(s), a `thumb.svg` card image, and sometimes `images/`. Shared code lives in `assets/`:

- `assets/games.js` is the catalogue (`window.COOLMATHS`): the tag vocabulary (`slug → label`) and one entry per game. **It is generated**: each game describes itself in `<slug>/meta.json` (`title`, `blurb`, `tags`, `level`, `order`, and `kind: "demo"` for something with no win or loss), and `node porting/build-catalogue.mjs` writes the file. Never edit it by hand; after a merge conflict in it, run the script again.
- `assets/concepts.js` is the concept graph (`window.COOLMATHS_CONCEPTS`) and the one place a tag is defined: its label and its prerequisite tags. `assets/recommend.js` (global `Recommend`, DOM-free) turns the graph and a player's progress into "what to play next"; the profile page, the home page and the MCP server all run this one file.
- `assets/progress.js` (global `Track`) keeps the player's record: visits, time, plays, outcomes and the position on screen. It writes through a backend, so pages never touch storage or a database: localStorage for a guest, the player's account once they sign in. `site.js` loads it on every game page; with no code in the page it records visits and each time `#status` gains `.win` or `.lose`. A page that calls `Track.start/state/end` itself (see `coins/`) includes the script before its own.
- `assets/auth.js` (an ES module) is sign-in with Google or GitHub through Firebase, offered on the profile page. On sign-in it switches `Track` to `assets/backends/firebase.js` (Cloud Firestore) and moves the browser's record into the account. Guests never load it. `assets/firebase-config.js` holds the project's public config and the pinned SDK version; `firebase/` holds the security rules and their emulator tests (`cd firebase && npm test`, and `npm run test:ui` for sign-in in a browser; both need Java).
- `assets/site.js` is loaded in `<head>` so the saved theme applies before paint. It injects the sticky header (logo, "All games", "Profile", theme toggle), a skip link, the footer, and, on game pages (`<body data-game="<slug>">`), the progress tracker. It needs nothing else: **a game page does not load the catalogue**, which grows with every game. It dispatches a `themechange` event on `window` when the theme flips (toggle or OS change), and registers the service worker.
- **The standard parts of a game page are stamped, not written**: `node porting/stamp-pages.mjs` writes, from `meta.json`, the `<head>` block between `<!-- stamp:head -->` markers (title, description, colour scheme, canonical address, manifest, icons, `site.css`, `site.js`), the `<body data-game data-kind>` attributes, the `<main id="main">` wrapper, and the concept-tag links under the `<h1>`. `porting/site.json` holds the site's address and name. Never edit a stamped part by hand; change the tool or `meta.json` and run it.
- `manifest.webmanifest`, `assets/icons/` and `sw.js` make the site installable and usable offline. The service worker asks the network first and keeps a copy, so nothing goes stale and there are no versions to bump; it answers from its copies only when offline.
- `assets/home.js` is the home page: search, a "how hard" filter, the idea filter, and cards a page at a time, written for a catalogue of a thousand or more (`porting/check-home-ui.mjs` tests it with a made-up 1,200).
- `assets/site.css` is the design system. Every colour is a CSS custom property on `:root`, redefined for dark mode both under `prefers-color-scheme: dark` (guarded by `:root:not([data-theme="light"])`) and under `:root[data-theme="dark"]`. It also styles the shared page parts: `.stage` (the play area panel), buttons (`button.primary` for the main action), `.controls`, `#status` (`.win`/`.lose`), `#rules`, `details#math`, and the Wikipedia hover cards.
- `assets/wiki-hovercard.js` turns `<a class="wiki-term" data-wiki="Page_Title">` into hover/focus previews from Wikipedia's REST summary API.
- `assets/logo-{light,dark}[-sm].webp` are the hand-drawn logo (by Harini Vardhan) with its background removed. The page shows the one matching the theme via `.logo-light`/`.logo-dark`.

`profile/` is the player's page (games played, concepts met, suggestions). It is a site page, not a game: it has no catalogue entry and reads the record only through `Track`.

`privacy/` says in plain words what the site keeps about a player; keep it true when changing what is stored. `signin/` is where a player lets the tutor see their record: an MCP client sends them there to sign in and press Allow. Like `profile/` it is a site page, not a game.

`mcp/` is the MCP tutor, a Node server deployed to Fly.io (`mcp/README.md`). `/mcp` is public; `/mcp/me` adds a signed-in player's own progress and position, read from Firestore. Its content is generated from the site at build time, so it is never edited to match a port; a game with a core gets tutor actions by adding `mcp/src/games/<slug>.ts`.

The home page (`index.html`, `assets/home.js`) renders the card grid from `games.js`, which only it and the profile page load. The URL hash is the active tag (`/#number-theory`), `?q=` the search and `?level=` the difficulty; a view with no matches shows an empty state.

## Porting a Java applet to JavaScript

Follow these rules when converting another applet. The existing games are the reference implementations: copy the structure of the closest one instead of inventing a new layout.

### 1. Understand the original first

- Read the bytecode with `node porting/disasm.mjs <Name>` (no decompiler is installed) and the page with `node porting/page.mjs <Name>`. Check that the page really embeds the applet: the manifest's URL comes from a name match and can be wrong. The byline links to the applet's own page.
- **Port behaviour faithfully.** Rules, win conditions, the computer opponent's strategy, board sizes, option ranges and messages should match the applet. Modernize the presentation, not the game. If you change a behaviour on purpose (e.g. dropping a real-time rush), say so in the commit message.
- **When the applet and its page disagree.** Applets were often built by copying a sibling, and keep its leftovers: Hanoi3c's closing message compared the move count with 2^N from plain Hanoi, and its win test accepted mixed piles the page's goal does not. A leftover that contradicts the puzzle the page states follows the page. A harmless quirk stays as it is (What's Next?'s "shifted powers" that never shift). Either way, say which in the math section and the commit message.
- **Check the page's claims, don't copy them.** Test formulas, minimum counts and "always/never" statements exhaustively where the sizes allow (see "The logic test" in `porting/README.md`). If a claim is wrong, the math section says so plainly and gives what is true.
- **Rights.** Bogomolny's applets are what this site ports. If an applet or its page credits someone else with all rights reserved (Hex7 is Robert Kirkland's "Hex 2.0"), take only the rules and options from it and write the computer player yourself; say so on the page and in the commit.

### 2. Code structure

- Folder `<slug>/`, where the slug is short, lowercase and hyphenated. It contains `index.html`, `<slug>.js`, `thumb.svg`, and `images/` only when you reuse the applet's own artwork.
- When the game has non-trivial logic (an opponent strategy, a solver, state transitions), put it in a DOM-free `<slug>-core.js` or `<name>-game.js` that defines one global (see `hourglass-core.js`, `coin-game.js`). The UI script only renders and handles input.
- **Verify the logic in Node before calling it done**, in `porting/check-<slug>.mjs`. Where the state space is small, check it exhaustively (e.g. every possible human reply against the computer's strategy, every generated problem is correct, the solver finds the true minimum). Compare the core with a second transcription of the applet's own method over the whole parameter space.
- The player's record has to know when a play ends. Keep win and loss on the shared `#status` classes (`.win` / `.lose`), and use `.done` for something finished that nobody won or lost: that is how the record sees the result with no code in the page. A round that ends some other way calls `Track.end({ outcome: "done" })`. Something that cannot be finished at all is `kind: "demo"` in `meta.json`, and counts as finished once explored. The page lint fails a game that does none of these. A game with a core should also save its position for the tutor: include `../assets/progress.js` before the core script and call `Track.state(position)` from the render function, as `hourglass/hourglass.js` does, then add an example with `node porting/check-positions-ui.mjs --update` and a reader in `mcp/src/games/<slug>.ts` (`docs/contracts.md`, sections 2 and 4).
- Plain ES2017+ with `"use strict"`, no libraries, no build step. Start each script with a comment block explaining the puzzle and the key idea the code relies on.
- Support mouse, touch and keyboard. Give interactive elements real `<button>`s or `tabindex` plus `aria-label`s, and use `aria-live` on status text. When drawing on a canvas, map pointer coordinates through `canvas.width / rect.width` so the board can shrink on phones.

### 3. Page format (in this order)

1. `<head>`: write only the page's own `<style>`. Everything else in it (title, metadata, the `../assets/` includes) is stamped by `node porting/stamp-pages.mjs <slug>`.
2. `<body>`, then `<main id="main">` around all the page's content, starting with the `<h1>` with the game name. The stamp adds `data-game`, `data-kind`, the `<main>` if it is missing, and the tag links below the `<h1>`.
3. Byline: `Puzzle by <a class="wiki-term" data-wiki="Alexander_Bogomolny" …>Alexander Bogomolny</a> (<a href="…original cut-the-knot page…">cut-the-knot.org</a>)`.
4. `<div id="rules">`, directly after the byline so players read it before the game: exactly two lines, **Game:** one sentence saying what the game is or what winning means, and **How to play:** one or two short sentences. Write for a young player: plain words, no jargon, no maths.
5. The play area, marked `class="stage"` (controls that set up the puzzle, like the hourglass's puzzle picker, may sit just above it).
6. `.controls` for options (sizes, modes) and buttons: `Reset`/`New Game`, with `class="primary"` on at most one main action. Status line in `#status` (`.win` / `.lose`).
7. `<details id="math"><summary>Look for the math</summary><div class="math-body">…`, closed by default. Start with a short intro paragraph. Then use 2–5 `<h2>` sections (not `<h3>`: the only heading above them is the `<h1>`) that build the explanation (the invariant, parity, formula or strategy behind the puzzle), with formulas in `<code>` or a `<blockquote>`. Link each named concept once with a `wiki-term` Wikipedia link. End with an optional `<p class="tip">` suggesting something to try.
8. Scripts after `</main>`, at the end of `<body>`: `../assets/wiki-hovercard.js`, then the core script, then the UI script.

### 4. Look and feel

- **Modern and minimal, in both light and dark themes.** Don't reproduce the applet look: no green `#c0dcc0` panels, grey AWT buttons, serif fonts or bevelled borders. The shared stylesheet already provides the system sans font, rounded panels, pill tags and buttons, so don't restyle those per page.
- Colours come only from the tokens in `assets/site.css`. Game-specific inline CSS is for layout and for the game's own objects. Fixed colours are fine for things that have a real colour of their own (chocolate brown, sand, coin metal), as long as they read on both `--stage` backgrounds.
- Use `--accent` for selection and highlights, `--good`/`--bad` for right/wrong, `--highlight` for hover or "just happened" flashes, and `--ink` for outlines of drawn objects.
- Canvas: read the tokens at draw time and redraw on the `themechange` event. SVG: style it with classes, not `fill`/`stroke` attributes.
- The page must work at 375px wide with no horizontal scrolling, **and still fit with the text at twice its size** (the gate checks both). Let boards scale down (`max-width: 100%`), let control rows wrap, size text and anything that holds text in `rem`, and never fix a width in `px` around text.
- Keep animations short. `site.css` already cuts every transition and animation short under `prefers-reduced-motion`; a page only needs its own rule if motion is essential to it.
- Every `<img>` has `alt` (empty for decoration) and `width`/`height`; a `<canvas>` has an `aria-label`; no inline `onclick=`; no `outline: none` without a `:focus-visible` style in its place. The page lint checks the first three.
- Reusing the applet's original sprites or images (like the RFWH characters or US coins) is fine when they carry the game's character. Use transparent-background versions.

### 5. Register the game

1. Add `<slug>/meta.json`: a `title`, a one- or two-sentence `blurb` that poses the challenge (often ending in a question), **at most 3 `tags`** naming the mathematical concepts from the "Look for the math" section, a `level` (1: anyone can start here; 2: the usual; 3: needs patience or earlier ideas), an `order` larger than any existing one (it sets the position on the home page), and `kind: "demo"` if it cannot be won or lost. Reuse existing tags; add a new one only when none fits, by giving it a label and prerequisites in `assets/concepts.js`. Then run `node porting/build-catalogue.mjs`, which writes `assets/games.js`, and `node porting/stamp-pages.mjs <slug>`, which writes the standard parts of the page.
2. Add `<slug>/thumb.svg`: viewBox `0 0 320 200`, transparent background, a simple flat illustration of the game's key moment, using mid-tone colours that read on both white and near-black. It's loaded via `<img>`, so it can't use the page's CSS variables. Embed any raster art as a data URI.
3. You don't need to edit `index.html` or `assets/games.js`; the grid is built from the generated catalogue.
4. Add the slug to `SLUG_TO_APPLET` in `porting/build-manifest.mjs`, give the applet a `"status": "ported"` entry with a one-line note in `porting/overrides.json`, and run `node porting/build-manifest.mjs`.

### 6. Before finishing

- `porting/verify.sh <slug>` must pass: it runs `node --check`, the logic test, the page lint, a headless load at phone and desktop width in both themes and at double text size, and checks that the page is as stamped and the catalogue current.
- Play through to a win and to a loss or impossible state with `porting/play/<slug>.mjs` and `node porting/play.mjs <slug>`, and look at the combined screenshot.
- Commit one game per commit, titled `Add <Game Name> puzzle`. The body says what the applet was, how faithfully it was ported and how that was verified, and what the math section covers.
