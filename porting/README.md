# Porting workflow

This folder holds the inventory and the automated gate for the porting campaign
described in [PLAN.md](PLAN.md). The porting recipe itself — folder layout, page
structure, look and feel — lives in [../CLAUDE.md](../CLAUDE.md) and is not
repeated here.

## Files

| File | What it is |
|---|---|
| `manifest.json` | Generated inventory: one entry per applet, with `kind`, `priority`, `ctkUrl`, `slug` and `status`. |
| `build-manifest.mjs` | Rebuilds the manifest from `classes.zip`. `--check` fails if the checked-in copy is stale. |
| `overrides.json` | Hand-checked corrections to the automatic classification. Always wins. |
| `ctk-urls.json` | Applet name → cut-the-knot.org page, matched against the site's `sitemap.xml`. |
| `fetch-ctk-urls.mjs` | Regenerates `ctk-urls.json`. The only part that touches the network. |
| `verify.sh` | The gate. Must exit 0 before a port is committed. |
| `lint-page.mjs` | Checks a game page against the CLAUDE.md rules. |
| `smoke-test.mjs` | Loads a page in headless Chromium, both themes, 375px and desktop. |
| `lib/archives.mjs` | Reads the applet inventory out of `classes.zip`. |

## Porting one applet

```sh
node porting/build-manifest.mjs --check    # confirm the manifest is current
```

1. **Pick the next applet.** Lowest `priority` with `status: "todo"`, which means
   games before demos before illustrations:

   ```sh
   node -e 'const m=require("./porting/manifest.json");
   const a=m.applets.find(x=>x.status==="todo"&&x.kind==="game");
   console.log(a.name, a.archive, a.ctkUrl)'
   ```

2. **Claim it** so parallel sessions do not collide: set its `status` to
   `in-progress` in `overrides.json`, then commit and push that one change
   before doing any work.

3. **Read the original.** Extract just that applet — only `classes.zip` is
   checked in, there is no `classes/` directory:

   ```sh
   unzip classes.zip 'classes/<Name>*' -d /tmp/applet
   cd /tmp/applet/classes && jar xf <Name>.jar && javap -c -p <Name>.class
   ```

   There is no decompiler installed, so `javap -c -p` on the bytecode is how you
   read an applet with no source. Read the `ctkUrl` page as well: it has the
   rules and the mathematical point, and it is the link the byline must use.

4. **Port it** following the CLAUDE.md recipe. Non-trivial logic goes in a
   DOM-free `<slug>-core.js`, and that core gets a Node test at
   `porting/check-<slug>.mjs`.

5. **Pass the gate.**

   ```sh
   porting/verify.sh <slug>
   ```

6. **Commit.** One game per commit, titled `Add <Game Name> puzzle`, with the
   manifest regenerated (`node porting/build-manifest.mjs`) and the applet's
   `overrides.json` entry set to `"status": "ported"`.

   If `verify.sh` cannot be made to pass after three attempts, set the status to
   `failed` with a note saying why, commit that, and move on.

## Prompt for a scheduled porting run

> Port the next applet from `porting/manifest.json` following `CLAUDE.md` and
> `porting/README.md`. Do not open a PR: pass `porting/verify.sh`, then commit
> and push directly to `web`. Start with `git pull --rebase`, claim the applet by
> pushing its `in-progress` status before porting, and if the final push is
> rejected, rebase and retry.

## What `kind` means

| kind | Meaning | Count |
|---|---|---|
| `game` | Interactive puzzle or game with a win condition or an opponent. | 100 |
| `demo` | Interactive demonstration or calculator; nothing to win. | 218 |
| `illustration` | A theorem diagram, usually with draggable points. | 931 |
| `helper` | Shared library or page chrome. Not an applet, never ported. | 39 |

The classification is deterministic, from the applet's own class names and the
section of cut-the-knot.org that its page sits in — see the comment at the top of
`build-manifest.mjs`. It is a starting order, not a verdict. When a port finds
its applet misfiled, the fix goes in `overrides.json` in the same commit.

About 170 applets have no `ctkUrl`, because no page in the sitemap is named after
them. Finding the page is part of porting one of those; put the URL in
`overrides.json` so it is not lost.

## The gate

`verify.sh <slug>` runs, in order:

1. `node --check` on every `.js` in the game folder.
2. `porting/check-<slug>.mjs`, the port's own logic test, when one exists.
   Required for any game with a core.
3. `lint-page.mjs`: section order, the two-line `#rules`, `#math` with 2–5
   `<h3>`, the three `../assets/` includes, `data-game` matching the folder, a
   `games.js` entry with at most 3 known tags, and a `thumb.svg` with viewBox
   `0 0 320 200`.
4. `smoke-test.mjs`: loads the page in headless Chromium at 375px and at desktop
   width, in light and dark, and fails on a console error, a failed request or
   horizontal overflow. Screenshots land in `/tmp/coolmaths-smoke/<slug>/`.
5. The site-wide check: the home grid loads, and every `games.js` slug has a
   folder.

Run it over everything with `porting/verify.sh --all`.
