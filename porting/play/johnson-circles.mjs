// Johnson Circles demo: two centre configurations, all five applet overlays,
// keyboard arrows on a handle, and every button. There is no win or loss; the
// status line reports the radius invariant and an explored diagram ends "done".
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs johnson-circles

export default async ({ page, first, log, shot, text }) => {
  const board = await page.locator("#board").boundingBox();

  const drag = async (name, fx, fy) => {
    const handle = await page.locator(`[aria-label^="Centre ${name}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };
  const options = async () => page.evaluate(() => [...document.querySelectorAll(".controls input")]
    .filter((el) => el.checked).map((el) => el.id).join(", ") || "none");

  log("start:", await text("#status"));
  log("overlays:", await options());
  await shot("start");

  // First configuration: swing Oa down and right; the fourth circle follows.
  await drag("Oa", 0.68, 0.72);
  log("after moving Oa:", await text("#status"));
  await shot("config-one");

  // Second configuration: show the page's named extras and move Oc up-left.
  for (const id of ["#names", "#anticomplementary", "#hint"]) await page.click(id);
  await drag("Oc", 0.34, 0.18);
  log("after moving Oc with names, anticomplementary and hint on:", await text("#status"));
  log("overlays:", await options());
  await shot("config-two");

  if (first) {
    // Two keyboard moves must keep focus on the same handle after redraw.
    await page.locator('[aria-label^="Centre Ob"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("focus after two arrow keys:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Press every button and switch every option in both directions.
    await page.click("#newBtn");
    log("new diagram:", await text("#status"));
    await page.click("#resetBtn");
    log("reset:", await text("#status"));
    for (const id of ["#names", "#homothety", "#anticomplementary", "#altitudes", "#hint"]) {
      await page.click(id);
    }
    log("all five overlays on:", await options());
    await shot("all-overlays");
    for (const id of ["#names", "#homothety", "#anticomplementary", "#altitudes", "#hint"]) {
      await page.click(id);
    }
    log("all overlays off:", await options());
  }

  await shot("final");
};
