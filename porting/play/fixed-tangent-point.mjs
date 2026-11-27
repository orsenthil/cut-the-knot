// Fixed Tangent Point: set up two different diagrams and look at the circle
// through P, the point Q, and the optional hint and statement overlays. This
// illustration has no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fixed-tangent-point

async function dragHandle(page, labelStart, dx, dy) {
  const handle = page.locator(`#board circle.geom-handle[aria-label^="${labelStart}"]`);
  const box = await handle.boundingBox();
  if (!box) throw new Error(`no handle found for ${labelStart}`);
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  await page.mouse.up();
}

export default async ({ page, first, log, shot, text }) => {
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: slide P along m, resize the circle from R, then
  // reveal the four right triangles behind the proof.
  await dragHandle(page, "Point P on the line", -70, 0);
  await dragHandle(page, "Rim point R", 10, -10);
  await page.click("#hintBtn");
  log("configuration one:", await text("#status"));
  await shot("config-one");
  if (!first) return; // the dark run only needs the screenshots above

  await page.click("#newBtn");

  // Second configuration: keyboard-only nudges of X and P, a moved centre,
  // and the tangent statement overlay.
  await page.locator('#board circle.geom-handle[aria-label^="Line point X"]').focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowLeft"); // X is fixed in x: the line stays level
  await page.locator('#board circle.geom-handle[aria-label^="Point P on the line"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  await dragHandle(page, "Centre O of the circle", 25, 10);
  await page.click("#statementBtn");
  log("configuration two:", await text("#status"));
  await shot("config-two");

  // Press every remaining control in a player's order and restore the start.
  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#statementBtn");
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
