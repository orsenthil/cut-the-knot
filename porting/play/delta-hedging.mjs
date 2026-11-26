// Delta Hedging: follow delta for a month (a win), then a month with no hedge.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs delta-hedging
export default async ({ page, first, log, shot, text }) => {
  await page.check("#hintBox");
  for (let d = 0; d < 20; d++) {
    const delta = await page.evaluate(() => [...document.querySelectorAll("#panel tr")].find((r) => /Delta today/.test(r.textContent)).querySelector("td").textContent);
    await page.fill("#sharesIn", delta); await page.dispatchEvent("#sharesIn", "change");
    await page.click("#nextBtn");
  }
  log("following delta:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("hedged");
  if (!first) return;
  await page.click("#newBtn");
  await page.fill("#sharesIn", "0"); await page.dispatchEvent("#sharesIn", "change");
  for (let d = 0; d < 20; d++) await page.click("#nextBtn");
  log("no hedge:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("naked");
};
