// BOL9: show three arrangements of the two perpendicular chords.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-9
export default async ({ page, first, log, shot, idle, text }) => {
  const ab = page.locator('#board [aria-label^="Horizontal chord"]');
  const cd = page.locator('#board [aria-label^="Vertical chord"]');
  const svg = await page.locator("#board").boundingBox();
  if (!svg) throw new Error("no board to drag");
  const scale = svg.width / 400; // viewBox units to screen pixels

  async function drag(handle, axis, target) {
    const box = await handle.boundingBox();
    if (!box) throw new Error("no chord handle to drag");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const current = Number(await handle.getAttribute(axis === "y" ? "cy" : "cx"));
    const delta = (target - current) * scale;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(axis === "y" ? x : x + delta, axis === "y" ? y + delta : y, { steps: 12 });
    await page.mouse.up();
  }

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("start");

  // First configuration: slide the horizontal chord above the centre.
  await drag(ab, "y", 120);
  log("AB above centre:", await text("#status"));
  await shot("ab-above-centre");

  // Second configuration: reset, then slide the vertical chord to the right.
  await page.click("#newBtn");
  await drag(cd, "x", 250);
  log("CD right of centre:", await text("#status"));
  await shot("cd-right-of-centre");

  if (!first) return; // the dark run only needs the screenshots above

  // Check, keyboard moves and every button.
  await page.click("#checkBtn");
  log("after Check:", await text("#status"));
  await ab.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  log("focus after keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keys:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#newBtn");
  log("after New arrangement:", await text("#status"));
};
