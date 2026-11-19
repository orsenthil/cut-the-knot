// Bad Limit: one option (break points per side). Set it to its maximum, make
// two keyboard moves with a focus check, press every button, then both
// extremes. The status sentence says in words what changed.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bad-limit
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  log("initial:", await text("#status"));
  await shot("start");

  // The only option, at its maximum: the finest staircase the applet allows.
  await page.locator("#nRange").fill("105");
  log("at the maximum (105 break points):", await text("#status"));
  await shot("max-break-points");

  // Two keyboard moves on the canvas; focus must stay on the board.
  await page.focus("#picture");
  await page.keyboard.press("ArrowLeft");
  log("after ArrowLeft:", await text("#status"), "| focus:", await focus());
  await page.keyboard.press("ArrowRight");
  log("after ArrowRight:", await text("#status"), "| focus:", await focus());
  await shot("keyboard");

  // Every button, in the order a player would press them.
  await page.click("#lessBtn");
  log("after Fewer:", await text("#status"));
  await page.click("#moreBtn");
  log("after More:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("buttons");

  // Both option extremes, including values outside the 1..105 range.
  await page.locator("#nRange").fill("1");
  log("at the minimum (1 break point):", await text("#status"));
  await shot("min-break-points");

  await page.locator("#nRange").fill("999");
  log("after an above-range value (clamped to 105):", await text("#status"));
  await page.locator("#nRange").fill("0");
  log("after a below-range value (clamped to 1):", await text("#status"));
  await shot("out-of-range");

  if (!first) return; // the dark run only needs the screenshots above
};
