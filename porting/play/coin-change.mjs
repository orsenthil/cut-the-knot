// Coin Change is a demo. Log the opening state, set every option to its
// largest (all eight coins, amount 30000) and compute, make two keyboard moves
// with a focus check, press both buttons in player order, then reach a dead
// end (no coins chosen means no amount can be made). Finally drive the amount
// below and above its range to see the spinbox clamp. The status says in words
// what happened; the readout gives the exact count for the selected bar.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs coin-change
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const setAmount = async (v) => {
    await page.locator("#amount").fill(String(v));
    await page.locator("#amount").dispatchEvent("change");
  };
  const setCoins = async (on) => {
    await page.evaluate((want) => {
      document.querySelectorAll(".denom").forEach((b) => {
        if (b.checked !== want) { b.checked = want; b.dispatchEvent(new Event("change", { bubbles: true })); }
      });
    }, on);
  };

  log("initial:", await text("#status"));
  await shot("start");

  // Every option at its largest: all eight denominations, amount 30000.
  await setCoins(true);
  await setAmount(30000);
  await page.click("#computeBtn");
  log("all options at maximum:", await text("#status"));
  await shot("max-options");

  // Two keyboard moves on the chart; focus must stay on the board.
  await page.focus("#chart");
  await page.keyboard.press("ArrowLeft");
  log("after ArrowLeft:", await text("#status"), "| focus:", await focus());
  await page.keyboard.press("ArrowRight");
  log("after ArrowRight:", await text("#status"), "| focus:", await focus());
  await shot("keyboard");

  // Both buttons, in the order a player would press them.
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  await page.click("#computeBtn");
  log("after Compute:", await text("#status"));
  await shot("done");

  if (!first) return; // the dark run only needs the screenshots above

  // Dead end: untick every coin, so no amount can be made at all.
  await setCoins(false);
  await page.click("#computeBtn");
  log("dead end (no coins):", await text("#status"));
  await shot("dead-end");

  // The spinner's range: below the minimum and above the maximum.
  await setCoins(true);
  await setAmount(0);
  await page.click("#computeBtn");
  log("amount below minimum:", await text("#status"));
  await setAmount(99999);
  await page.click("#computeBtn");
  log("amount above maximum:", await text("#status"));
  await shot("clamped");
};
