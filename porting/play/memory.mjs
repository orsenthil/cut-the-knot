// Memory: clear the board in Shape mode with perfect play, then try a wrong pair, then every mode.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs memory
export default async ({ page, first, log, shot, text }) => {
  const ids = await page.evaluate(() => Array.from(document.querySelectorAll(".card")).length);
  log("cards:", ids, "| caption:", await text("#caption"));
  await shot("face down");
  const cards = page.locator(".card");
  // read the hidden ids from the saved position
  const state = () => page.evaluate(() => { let s; window.Track = { state: (x) => { s = x; } }; return null; });
  const known = await page.evaluate(() => {
    // the page keeps its position in the closed scope; read each card by turning it up through the core's labels
    return null;
  });
  // a wrong pair first: turn two cards that differ, wait for them to turn back
  await cards.nth(0).click(); await cards.nth(1).click();
  log("two turned:", await text("#status"));
  await shot("two up");
  await page.waitForTimeout(1300);
  log("after the wait:", await text("#status"), "| face up:", await page.locator(".card.up").count());
  if (!first) return;
  // perfect play: find the partners by reading the aria labels as each card is turned up
  const seen = {};
  for (let i = 0; i < 20 && (await page.locator(".card.found").count()) < 20; i++) {
    if (await cards.nth(i).evaluate((c) => c.classList.contains("found"))) continue;
    await cards.nth(i).click();
    const label = await cards.nth(i).getAttribute("aria-label");
    const key = label.split(": ")[1];
    let partner = -1;
    for (let j = 0; j < 20; j++) if (j !== i && seen[j] === key) partner = j;
    if (partner >= 0) { await cards.nth(partner).click(); await page.waitForTimeout(500); delete seen[partner]; continue; }
    // else turn the next unseen card until it matches
    let j = i + 1;
    for (; j < 20; j++) {
      if (await cards.nth(j).evaluate((c) => c.classList.contains("found"))) continue;
      await cards.nth(j).click();
      const l2 = (await cards.nth(j).getAttribute("aria-label")).split(": ")[1];
      if (l2 === key) { await page.waitForTimeout(500); break; }
      seen[j] = l2; await page.waitForTimeout(1100);
      await cards.nth(i).click();
    }
  }
  log("progress:", await page.locator(".card.found").count(), "found |", await text("#status"));
  await shot("playing");
  for (const m of ["count1", "number", "allops"]) {
    await page.locator(`input[name="mode"]`).nth({ count1: 0, number: 3, allops: 7 }[m]).check();
    await cards.nth(0).click();
    log(m + ":", await text("#caption"), "|", (await cards.nth(0).getAttribute("aria-label")));
  }
  await shot("all ops");
  await page.click("#resetBtn");
  log("after reset:", await page.locator(".card.up").count(), "up");
};
