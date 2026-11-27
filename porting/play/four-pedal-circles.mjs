// Four Pedal Circles: two configurations — one spread out, one with P on a
// side so a pedal circle flattens towards a Simson line.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-pedal-circles
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
      box.y + (target.y / 300) * box.height,
      { steps: 8 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#trianglesBox");
  await page.click("#linesBox");

  // Configuration 1: a roomy quadrangle with every overlay shown.
  await dragPoint("P", { x: 255, y: 255 });
  await dragPoint("D", { x: 55, y: 225 });
  log("spread out:", await text("#status"));
  await shot("spread");
  if (!first) return; // the dark run has taken its screenshot of the same view

  // Configuration 2: put P on the line AB, so two pedal feet coincide and
  // their circles flatten; the port follows the applet's line fallback.
  await dragPoint("P", { x: 140, y: 190 });
  log("P on a side:", await text("#status"));
  await shot("flattened");

  // Keyboard movement must keep the focus on the moved point.
  const p = page.locator('[aria-label^="Point P."]');
  await p.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Point P.")) throw new Error("keyboard focus left point P");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
