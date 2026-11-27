// Expanded incircle demo: two configurations, with the rotations and the
// six-point circle shown. A keyboard move keeps focus on P. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs expanded-incircle

export default async ({ page, first, log, shot, text }) => {
  const drag = async (label, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="${label}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: push P past B, beyond the triangle, and show the arcs.
  await page.click("#rotationsCheck");
  await drag("Point P", 0.18, 0.92);
  log("P outside, rotations on:", await text("#status"));
  await shot("outside");

  // Configuration 2: a fresh scalene triangle with the six-point circle,
  // names and the Gergonne/Adams lines.
  await page.click("#resetBtn");
  await page.click("#circleCheck");
  await page.click("#namesCheck");
  await page.click("#gergonneCheck");
  await drag("Corner A", 0.78, 0.16);
  await drag("Corner C", 0.25, 0.28);
  log("scalene, all guides:", await text("#status"));
  await shot("scalene");

  if (first) {
    await page.locator('[aria-label^="Point P"]').focus();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focus after keyboard moves:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Every checkbox in both directions, then a fresh position.
    for (const id of ["#namesCheck", "#rotationsCheck", "#circleCheck",
      "#incircleCheck", "#gergonneCheck"]) await page.click(id);
    log("everything off:", await text("#status"));
    await shot("minimal");
    for (const id of ["#namesCheck", "#rotationsCheck", "#circleCheck",
      "#incircleCheck", "#gergonneCheck"]) await page.click(id);
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
  }

  await shot("final");
};
