# Porting card

The whole routine for porting one applet, for a person or a model of any size.
Follow the steps in order. Each step has one command and one test of "done".
You do not need to read anything else first; open `CLAUDE.md` only when a step
sends you there.

Set this once per shell (Playwright is installed globally):

```sh
export NODE_PATH=$(npm root -g)
```

## Steps

**1. Pick.** The next applet not yet ported:

```sh
node -e 'const a=require("./porting/manifest.json").applets.find(x=>x.status==="todo");console.log(a.name,a.kind)'
```

**2. Start.** Makes the folder with every file, and marks what is left to write.

```sh
node porting/new-port.mjs <Applet>            # add --kind demo --no-core for a picture with nothing to win
```

**3. Read.** One compact read of the page and the code.

```sh
node porting/brief.mjs <Applet>
node porting/disasm.mjs <Applet> --method <Name>     # one method in full, when you need it
```

Write down, before any code: the rules; how it ends (win, loss, done); the
options and their ranges; the messages; every claim the page makes (a formula,
a minimum, "always").

**4. Write the logic.** `<slug>/<slug>-core.js`: no `document`, no `window`.
The position is plain data. Port the rules and the computer's moves exactly.
Done when: `node --check <slug>/<slug>-core.js` is silent.

**5. Test the logic.** `porting/check-<slug>.mjs`: every case where the sizes
allow, and each claim from step 3.
Done when: `node porting/check-<slug>.mjs` prints `ok` with at least 10 checks.
If a claim on the page is false, keep the test honest and say so in the maths
section.

**6. Write the page's script.** `<slug>/<slug>.js`: draw the position, take
input, call the core. Keep the two lines that are already there: `say(text,
"win" | "lose" | "done")` when a play ends, and `Track.state(state)` in
`render()`.

**7. Fill in the page.** `<slug>/index.html`: the style, the two rules lines,
the play area, the controls, the maths section. Do not touch anything between
`<!-- stamp:` markers.

**8. Describe it.** `<slug>/meta.json`: `blurb`, 1 to 3 `tags` from
`assets/concepts.js`, `level` (1 start here, 2 usual, 3 tricky). Draw
`<slug>/thumb.svg`. Write `porting/play/<slug>.mjs`: a win, then a loss.

**9. Finish.** Runs everything mechanical and the gate, and lists what is wrong.

```sh
node porting/finish-port.mjs <slug>
```

Fix what it lists and run it again. Done when it prints `Ready.` After three
failed rounds, stop: set `"status": "failed"` with a one-line reason for the
applet in `porting/overrides.json`, and move on.

**10. Look, then commit.** `node porting/play.mjs <slug>` and look at the
screenshot. The gate only loads the page as it first opens, so the scenario
must also set every option to its largest value and take a screenshot: at
phone width nothing may overlap, and everything to press must stay as wide as
a fingertip (let a big board slide sideways inside `.stage` before you shrink
its parts). Make one move with the keyboard alone. Then the two `git` commands that step 9 printed.

## Rules that the gate cannot check

These are judgment, so they are yours:

1. **Faithful.** Same rules, same computer moves, same option ranges, same
   messages as the applet. Change the look, never the game. Anything changed
   on purpose goes in the commit message.
2. **Page against applet.** If the applet does something the page's puzzle
   does not say (a leftover from a sibling applet), follow the page. A
   harmless quirk stays. Say which in the maths section.
3. **Words for a child.** The two rules lines use plain words: no jargon, no
   maths. The maths goes in "Look for the math".
4. **Modern look.** No grey buttons, green panels or serif fonts from the
   applet. Colours only from the tokens in `assets/site.css`.
5. **Rights.** If the page credits someone else with all rights reserved, take
   the rules only and write the computer player yourself. Say so on the page.

## What the gate does check (so do not spend effort re-checking)

Scripts parse. The logic test passes. The page has its stamped head, one
`<main>`, one `<h1>`, the byline, exactly two rules lines, a `.stage`, a
`#status`, a closed maths section with 2 to 5 `<h2>`, alt text on images, a
label on a canvas, no inline `onclick`. A play can be seen to end. Nothing is
still marked `TODO(port)`. The page loads with a clean console at phone and
desktop width in light and dark, does not scroll sideways, and still fits with
the text at double size. The catalogue and manifest are current.

## Where things are

| Need | Look at |
|---|---|
| A port like yours to copy from | the table "Closest reference port" in `porting/README.md` |
| The tags you may use | `assets/concepts.js` |
| The colours you may use | the top of `assets/site.css` |
| What `Track` is | `docs/contracts.md`, section 2 |
| The long version of every rule | `CLAUDE.md`, "Porting a Java applet to JavaScript" |
