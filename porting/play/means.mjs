// The Means: drag a bar, change the exponent through -1, 0, 1, change the size, use the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs means
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  const bar = page.locator(".col:not(.avg)").nth(2);
  const box = await bar.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2, box.y + 2, { steps: 5 }); await page.mouse.up();
  log("a bar dragged to the top:", await bar.getAttribute("aria-valuenow"));
  for (const r of [1, -1, 2, 50, -50]) { await setRange(page, "#r", r); log("exponent", r + ":", await text("#readout")); }
  await shot("exponent -50");
  await setRange(page, "#r", 0); await shot("geometric");
  await setRange(page, "#n", 30);
  log("30 numbers:", await page.locator(".col:not(.avg)").count());
  await shot("thirty");
  if (!first) return;
  await bar.focus().catch(() => {});
  await page.locator(".col:not(.avg)").first().focus();
  await page.keyboard.press("ArrowUp"); await page.keyboard.press("Shift+ArrowDown");
  log("keyboard moved the first bar to:", await page.locator(".col:not(.avg)").first().getAttribute("aria-valuenow"), "| focus kept:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await setRange(page, "#n", 2);
  log("two numbers:", await text("#readout"));
  await page.click("#newBtn");
  log("new numbers:", await text("#readout"));
};
