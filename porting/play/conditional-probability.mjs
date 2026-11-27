// Conditional Probability: explore two rectangle configurations, then change
// the sample space and move a corner with the keyboard alone. There is no
// win or loss; the status explains whether the two events are independent.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs conditional-probability
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  // The board is 420 by 320 units; the grid occupies x=30..390, y=25..285.
  const toClient = (x, y) => ({ x: box.x + (x / 420) * box.width, y: box.y + (y / 320) * box.height });
  const drag = async (from, to) => {
    const a = toClient(from[0], from[1]), b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
  };
  const report = async (name) => {
    log(name + ":", await text("#cells"), "|", await text("#readout"), "|", await text("#status"));
    await shot(name);
  };

  // Configuration 1: the applet's starting rectangles on a 25x20 grid.
  await report("config1-default");

  // Configuration 2: make the page's independent pair (20 cells in A, 25 in
  // B, one cell of overlap), then switch to 24 columns as the page describes.
  const cw = 360 / 25, ch = 260 / 20;
  const at = (gx, gy) => [30 + gx * cw, 25 + gy * ch];
  await drag(at(6, 9), at(6, 8));      // A's bottom-right corner: height 6 -> 5
  await drag(at(11, 13), at(10, 12));  // B's bottom-right corner: 6x5 -> 5x4
  await drag(at(5, 8), at(5, 7));      // B's top-left corner: top row 8 -> 7
  await report("config2-independent");

  await page.fill("#nxInput", "24");
  await page.dispatchEvent("#nxInput", "change");
  await report("config2-dependent");

  // Both spinners at their maximum: the board must still fit on a phone.
  await page.fill("#nxInput", "30");
  await page.dispatchEvent("#nxInput", "change");
  await page.fill("#nyInput", "30");
  await page.dispatchEvent("#nyInput", "change");
  await report("max-grid");

  if (!first) return; // the dark run only needs the screenshots

  // Keyboard only: one cell right, then five cells down with Shift.
  const handle = page.locator("#board circle.corner-a").nth(2); // bottom-right
  const beforeKeys = await text("#cells");
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const afterKeys = await text("#cells");
  const focused = await page.evaluate(() => document.activeElement.getAttribute("aria-label") || "");
  log("keyboard:", afterKeys, "| focus =", focused);
  if (beforeKeys === afterKeys || !/^Rectangle A corner 3/.test(focused)) {
    throw new Error("arrow keys did not move the corner or lost focus");
  }
  await shot("config2-keyboard");

  await page.click("#resetBtn");
  log("reset:", await text("#cells"), "|", await text("#status"));
};
