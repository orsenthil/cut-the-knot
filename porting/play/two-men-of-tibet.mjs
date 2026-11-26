// The Two Men of Tibet: set a range that forces a turn back, walk it with
// no delay, show levels, a plateau, keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs two-men-of-tibet
export default async ({ page, first, log, shot, text }) => {
  await page.evaluate(() => window.scrollTo(0, document.getElementById("board").getBoundingClientRect().top + window.scrollY - 170));
  const set = async (i, h) => {
    const c = await page.locator(`#board .handle[data-i="${i}"]`).boundingBox();
    const b = await page.locator("#board").boundingBox();
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down();
    await page.mouse.move(c.x + c.width / 2, b.y + ((250 - h * 220) / 270) * b.height, { steps: 3 }); await page.mouse.up();
  };
  for (const [i, h] of [[1, 0.45], [2, 0.2], [3, 0.6], [4, 0.3], [5, 0.9]]) await set(i, h);
  await page.fill("#delayIn", "0");
  await page.check("#levelsBox");
  await page.click("#goBtn");
  await page.waitForFunction(() => document.getElementById("status").classList.contains("done"), null, { timeout: 20000 });
  log("journey:", await text("#status"));
  await shot("swapped");
  if (!first) return;
  await page.focus('#board .handle[data-i="2"]');
  const h3 = await page.evaluate(() => Number(document.querySelector('#board .handle[data-i="3"]').getAttribute("aria-valuenow")));
  await set(2, h3 / 100);
  await page.click("#goBtn");
  log("after setting peak 2 near peak 3:", await text("#status"));
  await page.focus('#board .handle[data-i="1"]');
  await page.keyboard.press("ArrowUp");
  log("keyboard:", await page.evaluate(() => document.activeElement.dataset.i));
  await page.click("#newBtn");
  log("new:", await text("#status"));
  await shot("new");
};
