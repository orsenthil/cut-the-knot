// Spigot for pi: 1000 digits, stop and continue, chunk and font sizes,
// a long run stopped by keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs spigot-for-pi
export default async ({ page, first, log, shot, text }) => {
  await page.click("#computeBtn");
  await page.waitForFunction(() => document.getElementById("status").classList.contains("done"), null, { timeout: 20000 });
  log("1000:", await text("#status"), "|", (await text("#out")).slice(0, 40));
  await shot("1000");
  if (!first) return;
  await page.fill("#nIn", "50000");
  await page.click("#computeBtn");
  await page.waitForTimeout(500);
  await page.click("#stopBtn");
  log("stopped:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  log("continued by keyboard:", await text("#status"));
  await page.click("#stopBtn");
  await page.fill("#chunkIn", "20"); await page.dispatchEvent("#chunkIn", "change");
  await page.fill("#fontIn", "40"); await page.dispatchEvent("#fontIn", "change");
  await shot("big");
  await page.fill("#chunkIn", "0"); await page.dispatchEvent("#chunkIn", "change");
  await page.fill("#fontIn", "100"); await page.dispatchEvent("#fontIn", "change");
  log("ranges:", await page.inputValue("#chunkIn"), await page.inputValue("#fontIn"));
  await page.fill("#nIn", "7"); await page.click("#computeBtn");
  await page.waitForFunction(() => document.getElementById("status").classList.contains("done"));
  log("7 digits:", await text("#out"));
};
