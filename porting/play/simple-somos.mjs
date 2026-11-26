// Simple Somos Sequence: the olympiad start, a start that raises the alarm,
// every control both ways, largest values.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs simple-somos
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"), "|", await text("#kLine"));
  await shot("olympiad");
  if (!first) return;
  await page.click('[data-bump="a:1"]');
  log("a = 2:", await text("#status"), "|", await text("#kLine"));
  await shot("alarm");
  await page.click('[data-bump="a:-1"]');
  await page.click('[data-bump="b:1"]');
  log("b = 2:", await text("#status"), "|", await text("#kLine"));
  await page.click('[data-bump="m:1"]');
  log("b = 2, m = 3:", await text("#status"), "|", await text("#kLine"));
  for (const k of ["m", "a", "b"]) { await page.fill(`#${k}Input`, "100"); await page.dispatchEvent(`#${k}Input`, "change"); }
  log("all 100:", await text("#status"));
  await page.fill("#mInput", "100"); await page.dispatchEvent("#mInput", "change");
  await page.fill("#aInput", "1"); await page.dispatchEvent("#aInput", "change");
  await page.fill("#bInput", "1"); await page.dispatchEvent("#bInput", "change");
  log("m = 100 from 1, 1:", await text("#status"));
  await shot("big");
  await page.focus('[data-bump="m:-1"]');
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  log("keyboard:", await page.inputValue("#mInput"), "| focus:", await page.evaluate(() => document.activeElement.dataset.bump));
  await page.fill("#mInput", "0"); await page.dispatchEvent("#mInput", "change");
  log("m below range:", await page.inputValue("#mInput"));
};
