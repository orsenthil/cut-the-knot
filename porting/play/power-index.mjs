// Weighted Voting and Power Indices: the start with indices on, [5: 3, 2, 1]
// (a dummy), a quota above the total, 15 players, the keyboard.
// Run with: NODE_PATH=... node porting/play.mjs power-index
export default async ({ page, first, log, shot, text }) => {
  const box = (i) => page.locator("#system input").nth(i);
  const set = async (i, v) => { await box(i).fill(String(v)); await box(i).dispatchEvent("change"); };
  await page.check("#computeBox");
  log("start:", await text("#summary"), "|", await page.locator("#table tbody").innerText());
  await shot("start");
  if (!first) return;
  await page.fill("#nIn", "3"); await page.dispatchEvent("#nIn", "change");
  await set(0, 5); await set(1, 3); await set(2, 2); await set(3, 1);
  log("[5: 3, 2, 1]:", await page.locator("#table tbody").innerText().then((t) => t.replace(/\n/g, " | ")), "|", await text("#note"));
  await shot("dummy");
  await set(0, 7);
  log("quota 7:", await text("#note"));
  await page.fill("#nIn", "20"); await page.dispatchEvent("#nIn", "change");
  await set(0, 60);
  log("15 players:", await text("#summary"), "| player 1:", await page.locator("#table tbody tr").first().innerText());
  await shot("15 players");
  await page.fill("#nIn", "1"); await page.dispatchEvent("#nIn", "change");
  log("1 player asked:", await page.inputValue("#nIn"));
  await box(1).focus(); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Tab");
  log("keyboard:", await text("#summary"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await page.click("#resetBtn");
  log("reset:", await text("#summary"));
};
