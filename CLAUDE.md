# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**coolmaths** is a static website of browser ports of Alexander Bogomolny's cut-the-knot.org Java applet puzzles, plus an arithmetic quiz (`maths-quiz/`). It uses plain HTML, CSS and vanilla JS: no build step, no package manager, no framework. The web work lives on the `web` branch. `master` holds the original upload.

`classes/` (and `classes.zip`) holds the original applets as `.jar`/`.zip` files, with decompiled or extracted Java sources in some cases (`*_src/`, e.g. `classes/RFWH_src/`, `classes/FlipThem_src/`). It is reference material for porting and is not part of the site. Ports aim to reproduce the original behaviour exactly (e.g. `coins/coin-game.js` mirrors `CoinGame.java`'s strategy).

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

To check a page visually, use headless Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --headless=new --screenshot=... --window-size=W,H URL`). Add `--force-dark-mode` for the dark theme. Headless windows are at least 500px wide, so load the page in a 375px `<iframe>` to test phone width. In dark mode Chrome can hang after writing the screenshot, so run it with a kill timeout. Pages with a `requestAnimationFrame` loop (hourglass) need `--timeout=` rather than `--virtual-time-budget=`.

## Architecture

Each game is a folder `<slug>/` containing `index.html`, its script(s), a `thumb.svg` card image, and sometimes `images/`. Shared code lives in `assets/`:

- `assets/games.js` is the catalogue (`window.COOLMATHS`): the tag vocabulary (`slug → label`) and one entry per game (`slug`, `title`, `blurb`, `tags`). The `slug` must match the folder name.
- `assets/site.js` is loaded in `<head>` after `games.js` so the saved theme applies before paint. It injects the sticky header (logo, "All games", theme toggle), the footer, and, on game pages, the concept-tag chips under the `<h1>`, using `<body data-game="<slug>">`. It dispatches a `themechange` event on `window` when the theme flips (toggle or OS change).
- `assets/site.css` is the design system. Every colour is a CSS custom property on `:root`, redefined for dark mode both under `prefers-color-scheme: dark` (guarded by `:root:not([data-theme="light"])`) and under `:root[data-theme="dark"]`. It also styles the shared page parts: `.stage` (the play area panel), buttons (`button.primary` for the main action), `.controls`, `#status` (`.win`/`.lose`), `#rules`, `details#math`, and the Wikipedia hover cards.
- `assets/wiki-hovercard.js` turns `<a class="wiki-term" data-wiki="Page_Title">` into hover/focus previews from Wikipedia's REST summary API.
- `assets/logo-{light,dark}[-sm].webp` are the hand-drawn logo (by Harini Vardhan) with its background removed. The page shows the one matching the theme via `.logo-light`/`.logo-dark`.

The home page (`index.html`) renders the card grid and tag filter bar from `games.js`. The URL hash is the active tag (`/#number-theory`), and an unknown tag shows an empty state.

## Porting a Java applet to JavaScript

Follow these rules when converting another applet. The existing games are the reference implementations: copy the structure of the closest one instead of inventing a new layout.

### 1. Understand the original first

- Find the applet in `classes/` (`<Name>.jar` / `.zip`, sometimes with a `*_src/` or `*_extracted/` folder next to it). Read the Java source when it exists. When there is only bytecode, extract it with `jar xf` and inspect it with `javap -c -p`; no decompiler is installed.
- Read the original cut-the-knot.org page for the puzzle's rules and the intended mathematical point. The byline links to that page.
- **Port behaviour faithfully.** Rules, win conditions, the computer opponent's strategy, board sizes and option ranges should match the applet. Modernize the presentation, not the game. If you change a behaviour on purpose (e.g. dropping a real-time rush), say so in the commit message.

### 2. Code structure

- Folder `<slug>/`, where the slug is short, lowercase and hyphenated. It contains `index.html`, `<slug>.js`, `thumb.svg`, and `images/` only when you reuse the applet's own artwork.
- When the game has non-trivial logic (an opponent strategy, a solver, state transitions), put it in a DOM-free `<slug>-core.js` or `<name>-game.js` that defines one global (see `hourglass-core.js`, `coin-game.js`). The UI script only renders and handles input.
- **Verify the logic in Node before calling it done.** Where the state space is small, check it exhaustively (e.g. every possible human reply against the computer's strategy, every generated problem is correct, the solver finds the true minimum).
- Plain ES2017+ with `"use strict"`, no libraries, no build step. Start each script with a comment block explaining the puzzle and the key idea the code relies on.
- Support mouse, touch and keyboard. Give interactive elements real `<button>`s or `tabindex` plus `aria-label`s, and use `aria-live` on status text. When drawing on a canvas, map pointer coordinates through `canvas.width / rect.width` so the board can shrink on phones.

### 3. Page format (in this order)

1. `<title>Game Name &mdash; coolmaths</title>`, and in `<head>` the three `../assets/` includes (`site.css`, `games.js`, `site.js`).
2. `<body data-game="<slug>">`, then `<h1>` with the game name. `site.js` inserts the tag chips below it automatically.
3. Byline: `Puzzle by <a class="wiki-term" data-wiki="Alexander_Bogomolny" …>Alexander Bogomolny</a> (<a href="…original cut-the-knot page…">cut-the-knot.org</a>)`.
4. The play area, marked `class="stage"`.
5. `.controls` for options (sizes, modes) and buttons: `Reset`/`New Game`, with `class="primary"` on at most one main action. Status line in `#status` (`.win` / `.lose`).
6. `<div id="rules">` with exactly two lines: **Goal:** one sentence saying what winning means, and **How to play:** one or two short sentences. Write for a young player: plain words, no jargon, no maths.
7. `<details id="math"><summary>Look for the math</summary><div class="math-body">…`, closed by default. Start with a short intro paragraph. Then use 2–5 `<h3>` sections that build the explanation (the invariant, parity, formula or strategy behind the puzzle), with formulas in `<code>` or a `<blockquote>`. Link each named concept once with a `wiki-term` Wikipedia link. End with an optional `<p class="tip">` suggesting something to try.
8. Scripts at the end of `<body>`: `../assets/wiki-hovercard.js`, then the core script, then the UI script.

### 4. Look and feel

- **Modern and minimal, in both light and dark themes.** Don't reproduce the applet look: no green `#c0dcc0` panels, grey AWT buttons, serif fonts or bevelled borders. The shared stylesheet already provides the system sans font, rounded panels, pill tags and buttons, so don't restyle those per page.
- Colours come only from the tokens in `assets/site.css`. Game-specific inline CSS is for layout and for the game's own objects. Fixed colours are fine for things that have a real colour of their own (chocolate brown, sand, coin metal), as long as they read on both `--stage` backgrounds.
- Use `--accent` for selection and highlights, `--good`/`--bad` for right/wrong, `--highlight` for hover or "just happened" flashes, and `--ink` for outlines of drawn objects.
- Canvas: read the tokens at draw time and redraw on the `themechange` event. SVG: style it with classes, not `fill`/`stroke` attributes.
- The page must work at 375px wide with no horizontal scrolling. Let boards scale down (`max-width: 100%`) and let control rows wrap.
- Keep animations short, and turn them off under `prefers-reduced-motion`.
- Reusing the applet's original sprites or images (like the RFWH characters or US coins) is fine when they carry the game's character. Use transparent-background versions.

### 5. Register the game

1. Add an entry to `assets/games.js`: `slug`, `title`, a one- or two-sentence `blurb` that poses the challenge (often ending in a question), and **at most 3 `tags`** naming the mathematical concepts from the "Look for the math" section. Reuse existing tag slugs; add a new one to `tags` only when no existing tag fits.
2. Add `<slug>/thumb.svg`: viewBox `0 0 320 200`, transparent background, a simple flat illustration of the game's key moment, using mid-tone colours that read on both white and near-black. It's loaded via `<img>`, so it can't use the page's CSS variables. Embed any raster art as a data URI.
3. You don't need to edit `index.html`; the grid is built from `games.js`.

### 6. Before finishing

- `node --check` every new script, and run the Node logic checks.
- Screenshot the page and the home grid in light and dark mode and at phone width (see "Running and checking"). Play through to a win and to a loss or impossible state.
- Commit one game per commit, titled `Add <Game Name> puzzle`. The body says what the applet was, how faithfully it was ported and how that was verified, and what the math section covers.
