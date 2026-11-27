// Given Common Chord: two configurations of the construction. It is a demo,
// so there is no win or loss to play through; the two screenshots show the
// ordinary two-line case and the one-line (tangent helper circle) case.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs given-common-chord
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`[aria-label^="${label}"]`);
  const drag = async (label, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: the two helper circles cross, so two lines work.
  await page.click("#hint");
  await page.click("#names");
  await drag("End B", 0.75, 0.125);
  log("configuration 1 (two lines):", await text("#status"));
  await shot("two-lines");

  // Configuration 2: slide A left until the helper circles only touch.
  await drag("End A", 0.26, 0.125);
  log("configuration 2 (one line):", await text("#status"));
  await shot("one-line");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the same handle afterwards.
  await handle("End B").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Every panel choice, in a player's order and in both directions.
  await page.click('input[value="2"]');
  log("both lines:", await text("#status"));
  await page.click('input[value="1"]');
  log("line 2:", await text("#status"));
  await page.click('input[value="0"]');
  await page.click("#hint");
  await page.click("#names");
  log("all drawing options off:", await text("#status"));
  await page.click("#hint");
  await page.click("#names");
  log("all drawing options back on:", await text("#status"));

  // An impossible length: the bar is longer than twice the centre gap.
  await drag("End A", 0.05, 0.125);
  log("no solution:", await text("#status"));
  await shot("no-solution");

  await page.click("#resetBtn");
  log("after Reset diagram:", await text("#status"));
};
