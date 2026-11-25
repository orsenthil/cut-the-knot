// The Minimax Principle: Reset until the red numbers are equal; edit an entry; largest sizes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs min-max
const setRange = (page, id, v) => page.locator(id).evaluate((el, val) => { el.value = val; el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");
  let tries = 0;
  while (!(await page.locator("button.c.saddle").count()) && tries < 200) { await page.click("#resetBtn"); tries++; }
  log("a saddle point after", tries, "resets:", await text("#status"));
  await shot("saddle");
  const b = page.locator("button.c.saddle").first();
  const box = await b.boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  log("after raising the saddle entry:", await text("#status"));
  if (!first) return;
  await page.locator("button.c").first().focus();
  await page.keyboard.press("ArrowDown");
  log("keyboard lowered the first entry:", await page.locator("button.c").first().textContent(), "| focus kept:", await page.evaluate(() => document.activeElement.className));
  await setRange(page, "#rows", 12); await setRange(page, "#cols", 12); await setRange(page, "#max", 20);
  log("12 by 12:", await page.locator("button.c").count(), "entries");
  await shot("big");
  await setRange(page, "#rows", 2); await setRange(page, "#cols", 2);
  log("2 by 2:", await page.locator("button.c").count());
};
