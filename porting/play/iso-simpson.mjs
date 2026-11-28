// Iso Simpson: two configurations — P inside the triangle with all overlays
// shown, then P on the circumcircle where the pedal circle opens into the
// Simson line. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs iso-simpson
export default async ({ page, first, log, shot, text }) => {
  const dragPoint = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const handle = page.locator(`[aria-label^="Point ${name}."]`);
    const dot = await handle.boundingBox();
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 250) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));

  // Every overlay, and P inside the circumcircle so Q and the common circle
  // appear. The three reflected rays and the six feet are visible.
  await page.click("#perpsBox");
  await page.click("#circleBox");
  await page.click("#anglesBox");
  await dragPoint("P", { x: 180, y: 140 });
  log("P inside:", await text("#status"));
  await shot("pedal-circle");

  // P exactly on the dashed circumcircle: the circle becomes the Simson line.
  await dragPoint("P", { x: 283.3, y: 125 });
  log("P on the circumcircle:", await text("#status"));
  await shot("simson-line");

  // Arrow keys must keep focus on the moved handle after the redraw.
  const p = page.locator('[aria-label^="Point P."]');
  await p.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Point P.")) throw new Error("keyboard focus left point P");

  if (!first) return; // the dark run has taken both screenshots already
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
