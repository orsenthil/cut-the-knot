// Light Bulbs: watch two different ring configurations run to the end.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs light-bulbs
export default async ({ page, first, log, shot, idle, text }) => {
  async function setNumber(selector, value) {
    await page.fill(selector, String(value));
    await page.dispatchEvent(selector, "change");
  }
  async function runBatch() {
    await page.click("#performBtn");
    await idle(); // the .busy class is removed when the batch ends
  }

  if (first) {
    await page.focus("#board .current-handle");
    await page.keyboard.press("ArrowRight");
    log("after one arrow-key step:", await text("#status"));
    log("focus after keyboard step:", await page.evaluate(() => document.activeElement?.getAttribute("class")));
  }

  // First configuration: the applet's displayed defaults, with eight steps.
  await setNumber("#bulbsIn", 15);
  await setNumber("#lookIn", 1);
  await setNumber("#skipIn", 0);
  await setNumber("#stepsIn", 8);
  await page.check("#fastBox");
  await runBatch();
  log("15 bulbs, look ahead 1, skip 0:", await text("#status"));
  await shot("first");

  // Second configuration: a small ring with a wider jump and a skip.
  await setNumber("#bulbsIn", 6);
  await setNumber("#lookIn", 2);
  await setNumber("#skipIn", 1);
  await setNumber("#stepsIn", 12);
  await runBatch();
  log("6 bulbs, look ahead 2, skip 1:", await text("#status"));
  await shot("second");
};
