// The Sealed Bids demo: try the largest table, press every button, change
// bids with the keyboard, take both option extremes and build the worked
// example by hand.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sealed-bids

export default async ({ page, log, shot, text }) => {
  const line = async (key) =>
    (await page.locator(`td.${key}`).allTextContents()).join(" | ");
  const winners = async () =>
    (await page.locator("td.winner .win-badge").count());

  log("at the start:", await line("total"), "| fair:", await line("fair"));
  log("winning bids:", await winners(), "| status:", await text("#status"));
  await shot("start");

  // Both options at their maximum: a wide table slides inside the stage.
  await page.fill("#playersInput", "26");
  await page.press("#playersInput", "Tab");
  await page.fill("#itemsInput", "15");
  await page.press("#itemsInput", "Tab");
  log("maximum table:", await page.inputValue("#playersInput"), "bidders,",
    await page.inputValue("#itemsInput"), "items; stage scroll:",
    await page.evaluate(() => {
      const e = document.querySelector("#stage .scroll");
      return e.scrollWidth - e.clientWidth;
    }));
  log("status at maximum:", await text("#status"));
  await shot("maximum");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator(".bid").first().focus();
  await page.keyboard.press("ArrowRight");
  let focus = await page.evaluate(() => document.activeElement?.className + ":" + document.activeElement?.dataset.player);
  log("after one ArrowRight, focus:", focus, "| bid:", await page.locator(".bid").first().textContent());
  await page.keyboard.press("ArrowLeft");
  focus = await page.evaluate(() => document.activeElement?.className + ":" + document.activeElement?.dataset.player);
  log("after one ArrowLeft, focus:", focus, "| status:", await text("#status"));
  await shot("keyboard");

  // Press every button in a player's order, including both halves of a bid.
  for (const id of ["playersDown", "playersUp", "itemsDown", "itemsUp"]) {
    await page.click(`#${id}`);
    log(`${id}: ${await page.inputValue("#playersInput")} bidders, ${await page.inputValue("#itemsInput")} items`);
  }
  const bid = page.locator(".bid").first();
  const box = await bid.boundingBox();
  await page.click(".bid >> nth=0", { position: { x: 4, y: box.height / 2 } });
  log("left half of a bid lowered it to:", await bid.textContent());
  await page.click(".bid >> nth=0", { position: { x: box.width - 4, y: box.height / 2 } });
  log("right half raised it back to:", await bid.textContent());
  await page.click("#newBidsBtn");
  log("New bids:", await text("#status"));
  await shot("buttons");

  // Both extremes of both spinners: below the minimum and above the max.
  for (const value of ["1", "100"]) {
    await page.fill("#playersInput", value);
    await page.press("#playersInput", "Tab");
    log(`bidders entered as ${value} follows the applet and shows`, await page.inputValue("#playersInput"));
  }
  for (const value of ["0", "99"]) {
    await page.fill("#itemsInput", value);
    await page.press("#itemsInput", "Tab");
    log(`items entered as ${value} follows the applet and shows`, await page.inputValue("#itemsInput"));
  }
  await shot("extremes");

  // Build the worked table by hand: A bids 9,4,2; B bids 3,8,1; C bids 0,6,7.
  await page.fill("#playersInput", "3");
  await page.press("#playersInput", "Tab");
  await page.fill("#itemsInput", "3");
  await page.press("#itemsInput", "Tab");
  const wanted = [[9, 4, 2], [3, 8, 1], [0, 6, 7]];
  for (let p = 0; p < 3; p++) {
    for (let i = 0; i < 3; i++) {
      const button = page.locator(`.bid[data-player="${p}"][data-item="${i}"]`);
      await button.focus();
      const current = Number(await button.textContent());
      const key = current < wanted[p][i] ? "ArrowRight" : "ArrowLeft";
      for (let n = current; n !== wanted[p][i]; n += key === "ArrowRight" ? 1 : -1) {
        await page.keyboard.press(key);
      }
    }
  }
  log("the worked table's totals:", await line("total"));
  log("fair shares:", await line("fair"));
  log("owed:", await line("owed"), "| cash:", await line("cash"));
  log("winning bids marked:", await winners());
  log("final status:", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
