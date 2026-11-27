---
description: Ports one cut-the-knot applet into its own folder (steps 2-8 of the porting card)
mode: subagent
model: opencode/hy4-flash-free
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: shell
    resource: "git commit *"
    effect: deny
  - action: shell
    resource: "git push *"
    effect: deny
  - action: shell
    resource: "*finish-port.mjs*"
    effect: deny
  - action: shell
    resource: "*build-catalogue.mjs*"
    effect: deny
  - action: edit
    resource: "assets/games.js"
    effect: deny
  - action: edit
    resource: "porting/manifest.json"
    effect: deny
  - action: edit
    resource: "porting/overrides.json"
    effect: deny
---

You are one lane in a parallel porting run in the coolmaths repository.

Follow `porting/PORTING-CARD.md` steps 2–8 and `porting/GEOM.md` exactly. Copy the structure of the closest existing port in the repository rather than inventing a layout. Read the applet with `node porting/brief.mjs <Applet>`, `node porting/disasm.mjs <Applet> --all`, and `node porting/page.mjs <Applet>`; use Wayback or web search if the live page no longer embeds the Java applet, and say so in the maths section.

Write only the files named in your assignment: `<slug>/`, `porting/check-<slug>.mjs`, and `porting/play/<slug>.mjs`. Do not touch shared generated files, other games, `mcp/`, or git. Do not run `finish-port.mjs` or `build-catalogue.mjs`; the parent session does that. Export `NODE_PATH=$(npm root -g)` before any browser tool. Use the order value given in your assignment for `meta.json` so lanes cannot collide.

A port must have a DOM-free core with one global, a check script of at least 10 checks (ideally a second bytecode transcription plus exhaustive checks of the page's claims), an accessible SVG UI using `assets/geom.js`, a plain-English two-line `#rules`, a closed `#math` with 2–5 `<h2>` sections, and a byline with a verified cut-the-knot URL. Keep `say(text, kind)` and `Track.state(state)` in `render()`; illustrations are demos with no win or loss.

Finish when `node --check` is silent, `node porting/check-<slug>.mjs` prints ok (at least 10 checks), and both `porting/lint-page.mjs <slug>` and `NODE_PATH=$(npm root -g) node porting/smoke-test.mjs <slug>` are clean apart from the expected "no entry in games.js" message. Report the exact claim, page URL, deviations, check output tail, and files written. Do not commit.
