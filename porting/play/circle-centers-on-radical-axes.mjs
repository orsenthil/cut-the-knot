// Circle Centers On Radical Axes: drag the six points into two different
// configurations and look at the radical axes and the lit centre dots. There
// is no win or loss in this illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-centers-on-radical-axes

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

  // First configuration: move P's centre and resize Q from its rim dot.
  await dragHandle(page, "Centre of circle P", 38, 22);
  await dragHandle(page, "Rim of circle Q", -12, -26);
  log("configuration one:", await text("#status"));
  await shot("config-one");
  if (!first) return; // the dark run only needs the screenshots above

  await page.click("#newBtn");

  // Second configuration: keyboard-only nudge, another resize, then the hint.
  await page.locator('#board circle.geom-handle[aria-label^="Centre of circle R"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  await dragHandle(page, "Rim of circle P", 26, 10);
  await page.click("#hintBtn");
  log("configuration two:", await text("#status"));
  await shot("config-two");

  await page.click("#namesBtn");
  await page.click("#hintBtn");
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
