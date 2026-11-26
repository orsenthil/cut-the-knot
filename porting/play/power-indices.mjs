// Fast Power Indices: the Electoral College, the Security Council, a dummy
// made by hand, a quota above the total, adding and removing players.
// Run with: NODE_PATH=... node porting/play.mjs power-indices
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#summary"), "| California:", await page.locator("#table tbody tr").first().innerText().then((t) => t.replace(/\s+/g, " ")));
  await page.selectOption("#setSel", "Security Council");
  log("Security Council:", await page.locator("#table tbody tr").first().innerText().then((t) => t.replace(/\s+/g, " ")), "|", await page.locator("#table tbody tr").last().innerText().then((t) => t.replace(/\s+/g, " ")));
  await shot("security council");
  if (!first) return;
  await page.selectOption("#setSel", "European Union");
  await page.fill("#quotaIn", "86"); await page.dispatchEvent("#quotaIn", "change");
  log("EU quota 86:", await text("#note"), "| set:", await page.inputValue("#setSel"));
  await page.fill("#quotaIn", "88"); await page.dispatchEvent("#quotaIn", "change");
  log("quota 88:", await text("#note"));
  await page.fill("#quotaIn", "62"); await page.dispatchEvent("#quotaIn", "change");
  await page.click("#addBtn");
  log("added:", await text("#summary"), "|", await text("#note"));
  await page.locator(".remove").first().click();
  log("removed France:", await text("#summary"));
  const w = page.locator("#table tbody input").first();
  await w.focus(); await page.keyboard.press("ArrowUp"); await w.dispatchEvent("change");
  log("keyboard:", await text("#summary"), "| focus:", await page.evaluate(() => document.activeElement.getAttribute("aria-label")));
  await shot("custom");
};
