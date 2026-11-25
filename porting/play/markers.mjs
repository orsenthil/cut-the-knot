// Markers: 3 players, drag a marker, then 10 players, then the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs markers
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("three");
  const h = page.locator(".handle").first();
  const box = await h.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 20, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  log("after dragging:", (await text("#rounds")).slice(0, 90));
  await page.locator("#n").evaluate((el) => { el.value = 10; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("ten players:", await page.locator(".handle").count(), "markers |", await page.locator("#rounds li").count(), "rounds");
  await shot("ten");
  if (!first) return;
  await page.locator(".handle").nth(4).focus();
  const before = await page.locator(".handle").nth(4).getAttribute("aria-valuenow");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("Shift+ArrowRight");
  const after = await page.locator(".handle").nth(4).getAttribute("aria-valuenow");
  log("keyboard moved a marker:", before, "->", after, "| focus kept:", await page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label")));
  await page.click("#newBtn");
  log("new markers:", await text("#status"));
};
