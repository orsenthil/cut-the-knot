// Fourth degree: move sliders, switch the three curves, change the range.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fourth-degree
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const setRange = async (id, v) => { await page.locator("#" + id).evaluate((e, val) => { e.value = val; e.dispatchEvent(new Event("input", { bubbles: true })); }, String(v)); };
  log("initial:", (await text("#info")).slice(0, 120));
  await shot("initial");
  await page.check("#dBox"); await setRange("c4", 10); await setRange("c2", -10); await page.fill("#yIn", "1000"); await page.press("#yIn", "Tab");
  log("largest settings:", (await text("#info")).slice(0, 100), "| done =", await isDone());
  await shot("max-options");
  await page.click("#resetBtn");
  await setRange("c3", 3); await setRange("c1", -2);
  log("moved m3, m1:", (await text("#info")).slice(0, 130), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await setRange("c4", 0);
  log("m4 = 0:", await text("#info"));
  await page.uncheck("#gBox"); await page.uncheck("#lBox"); await page.uncheck("#dBox");
  await page.fill("#yIn", "0"); await page.press("#yIn", "Tab");
  log("range 0:", await text("#status"), "|", await page.inputValue("#yIn"));
  await page.locator("#c2").focus(); await page.keyboard.press("ArrowRight");
  log("keyboard on a slider:", await page.inputValue("#c2"));
  await page.click("#resetBtn");
  log("after Reset:", await page.inputValue("#c4"), "| done =", await isDone());
  await shot("reset");
};
