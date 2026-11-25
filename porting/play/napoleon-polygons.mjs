// Napoleon's Theorem and the PDN theorem: drag a corner, show triangles, a triangle (n = 3), a star, the largest.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs napoleon-polygons
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("pentagon");
  const v = page.locator('.vert[data-i="0"]');
  const b = await v.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + 60, b.y - 50, { steps: 8 }); await page.mouse.up();
  log("after dragging a corner:", await text("#readout"));
  await page.check("#tri");
  await shot("triangles");
  await setRange(page, "#m", 2);
  log("leave out 2:", await text("#readout"));
  await shot("star");
  if (!first) return;
  await page.uncheck("#tri");
  await setRange(page, "#n", 3);
  log("N = 3:", await text("#readout"));
  await setRange(page, "#m", 0);
  log("leave out 0:", await text("#readout"));
  await setRange(page, "#n", 15);
  await setRange(page, "#m", 7);
  log("N = 15, leave out 7:", await text("#readout"));
  await shot("fifteen");
  await page.locator('.vert[data-i="3"]').focus();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Shift+ArrowDown");
  log("keyboard moved a corner, focus kept:", await page.evaluate(() => document.activeElement.getAttribute("data-i")));
  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
};
