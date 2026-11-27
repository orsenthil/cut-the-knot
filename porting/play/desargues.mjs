// Desargues: one perspective-from-a-point view, then one perspective-from-a-line
// view. Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs desargues
export default async ({ page, first, log, shot, text }) => {
  const dragCorner = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const handle = page.locator(`[aria-label^="Corner ${name}."]`);
    const dot = await handle.boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 300) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  const opening = {
    A1: { x: 102, y: 144 }, B1: { x: 214, y: 90 }, C1: { x: 142, y: 260 },
    A2: { x: 336, y: 188 }, B2: { x: 258, y: 110 }, C2: { x: 288, y: 242 },
  };

  // Configuration 1: put the second triangle on rays through O = (200,150),
  // so A1A2, B1B2 and C1C2 really do meet at one point.
  const O = { x: 200, y: 150 };
  const factors = { A2: 1.4, B2: 0.6, C2: 1.2 };
  for (const name of ["A2", "B2", "C2"]) {
    const p = opening[name.slice(0, 1) + "1"];
    await dragCorner(name, {
      x: O.x + factors[name] * (p.x - O.x),
      y: O.y + factors[name] * (p.y - O.y),
    });
  }
  const directStatus = await text("#status");
  log("direct configuration:", directStatus);
  if (!directStatus.includes("meet at the yellow dot")) throw new Error("no centre dot shown");
  await shot("direct");
  if (!first) return; // the dark run has taken its screenshot of the same view

  // Configuration 2: a homology with centre (80,260) and a nearly horizontal
  // axis, so ab, bc and ca line up. Computed independently of the page's core.
  await page.click("#resetBtn");
  const centre = { x: 80, y: 260 };
  const axis = { x: 180, y: 120 };
  const direction = { x: 1, y: 0.2 };
  const nLength = Math.hypot(-direction.y, direction.x);
  const n = { x: -direction.y / nLength, y: direction.x / nLength };
  const offset = (axis.x - centre.x) * n.x + (axis.y - centre.y) * n.y;
  const k = 1.6;
  for (const [name, key] of [["A2", "A1"], ["B2", "B1"], ["C2", "C1"]]) {
    const X = opening[key];
    const f = offset / ((X.x - centre.x) * n.x + (X.y - centre.y) * n.y);
    const t = f / (1 - k * (1 - f));
    await dragCorner(name, {
      x: centre.x + t * (X.x - centre.x),
      y: centre.y + t * (X.y - centre.y),
    });
  }
  await page.click("#converseBtn");
  const converseStatus = await text("#status");
  log("converse configuration:", converseStatus);
  if (!converseStatus.includes("lie on one line")) throw new Error("no axis reported");
  await shot("converse");

  // Keyboard movement must leave the focus on the moved corner.
  const a = page.locator('[aria-label^="Corner A1."]');
  await a.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Corner A1.")) throw new Error("keyboard focus left the corner");

  await page.click("#directBtn");
  log("back to direct:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
