// Combi Gem: explore the collection, then press every option and button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs combi-gem
export default async ({ page, first, log, shot, idle, text }) => {
  const setNumber = async (selector, value) => {
    await page.locator(selector).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };
  const statusClass = async () => (await page.locator("#status").getAttribute("class")) || "";

  // What the page opens with: the applet's 1, 2, 3, 4 and six pairwise sums.
  log("initial status:", await text("#status"));
  log("initial sums:", await text("#sums"));
  await shot("initial");

  // Every option at its largest value, as the card's step 10 asks.
  await setNumber("#sizeInput", "9");
  await setNumber("#summondsInput", "5");
  log("maximum options:", await text("#status"));
  log("size at maximum:", await text("#sizeInput"), "summonds at maximum:", await text("#summondsInput"));
  log("number of sums at maximum:", await page.locator(".sumChip").count());
  await shot("max");
  if (!first) return; // the dark run only needs the two screenshots above

  // Start over, then change a number with the mouse: right half adds one,
  // left half takes one away. The record must learn that this demo was explored.
  await page.click("#newBtn");
  log("after Start over:", await text("#status"));
  let box = await page.locator('.numCell[data-index="0"]').boundingBox();
  await page.mouse.click(box.x + box.width * 0.82, box.y + box.height * 0.5);
  log("after tapping the right half:", await text("#status"));
  await page.mouse.click(box.x + box.width * 0.18, box.y + box.height * 0.5);
  log("after tapping the left half:", await text("#status"));
  log("status class after exploring:", await statusClass());
  if (!/done/.test(await statusClass())) throw new Error("exploring the demo did not mark it done");

  // Two moves with the keyboard alone; the focus must stay on the board.
  await page.locator('.numCell[data-index="2"]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() => (document.activeElement && document.activeElement.className) || "");
  log("focus after two keyboard moves:", focused);
  if (!/numCell/.test(focused)) throw new Error("keyboard moves took focus off the board");
  log("after keyboard moves:", await text("#status"));

  // The Pop frame button in the applet: the complete list, then folded away.
  await page.click("#listBtn");
  log("after Show all sums:", await text("#status"));
  log("full list has lines:", (await text("#allSumsText")).split("\n").length);
  await shot("full-list");
  await page.click("#listBtn");
  log("after Hide the full list:", await text("#status"));

  // Economize off at a small size: with two summonds each pair appears twice.
  await setNumber("#sizeInput", "3");
  await setNumber("#summondsInput", "2");
  await page.locator("#econInput").uncheck();
  log("Economize off:", await text("#status"));
  log("sum chips with Economize off:", await page.locator(".sumChip").count());
  await shot("econ-off");
  await page.locator("#econInput").check();
  log("Economize back on:", await text("#status"));
  log("sum chips with Economize on:", await page.locator(".sumChip").count());

  // The dead end: the controls refuse values outside the applet's ranges.
  await page.click("#newBtn");
  await setNumber("#sizeInput", "1");
  log("size below the range clamps to:", await text("#sizeInput"));
  await setNumber("#sizeInput", "99");
  log("size above the range clamps to:", await text("#sizeInput"));
  await setNumber("#summondsInput", "1");
  log("summonds below the range clamps to:", await text("#summondsInput"));
  await setNumber("#summondsInput", "99");
  log("summonds above the range clamps to:", await text("#summondsInput"));
  await page.click("#newBtn");
  log("after final Start over:", await text("#status"));
  await idle();
  await shot("reset");
};
