// Fagnano IV: start with winking eyes, then drag the six dots into the
// orthic configuration (open eyes) and an obtuse one (strict bound).
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fagnano-iv
import { loadCore } from "../lib/load-core.mjs";

const Core = loadCore("fagnano-iv/fagnano-iv-core.js", "FagnanoIvCore");

export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);

  // Go from board units to CSS pixels through the SVG's own transform, the
  // same route Geom uses for pointer drags.
  const client = (p) => page.evaluate(({ x, y }) => {
    const m = document.getElementById("board").getScreenCTM();
    const q = new DOMPoint(x, y).matrixTransform(m);
    return { x: q.x, y: q.y };
  }, p);

  const drag = async (name, local) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const to = await client(local);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  let game = Core.start();
  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: a different acute triangle, then P, Q and R placed on
  // the three altitude feet. The status should report three open eyes.
  const apex = { x: 170, y: 45 };
  await drag("A", apex);
  game = Core.move(game, "A", apex);
  const f = Core.compute(game);
  await drag("P", f.Ha);
  await drag("Q", f.Hb);
  await drag("R", f.Hc);
  await page.check("#hintBox");
  const orthic = await text("#status");
  log("orthic configuration:", orthic);
  if (!orthic.includes("All three eyes are open")) throw new Error("the eyes did not all open");
  await shot("orthic");

  if (!first) return; // the dark run only needs the two configuration shots

  // Configuration 2: an obtuse triangle. The bound is still true but no
  // inscribed triangle can reach it, so the eyes stay shut.
  await page.click("#resetBtn");
  game = Core.start();
  const obtuseCorner = { x: 268, y: 128 };
  await drag("C", obtuseCorner);
  game = Core.move(game, "C", obtuseCorner);
  log("obtuse configuration:", await text("#status"));
  log("bound there:", `perimeter ${Core.compute(game).perimeter.toFixed(1)}, limit ${Core.compute(game).bound.toFixed(1)}`);
  await shot("obtuse");

  // Both options, in both directions, and a keyboard-only move whose focus
  // must survive the redraw.
  await page.check("#hintBox");
  await page.uncheck("#namesBox");
  log("hint on and names off:", await text("#status"));
  await shot("options");
  await page.check("#namesBox");
  await page.uncheck("#hintBox");
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  if (!focused.startsWith("Point B")) throw new Error("keyboard focus left the board");
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
