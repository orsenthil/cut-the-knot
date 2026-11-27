// EuricaCyclic: two configurations of the same illustration of Miquel's point.
// This is a demo with no win or loss, so the scenario shows two shapes instead.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs eurica-cyclic
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (locator, dx, dy) => {
    const box = await locator.boundingBox();
    if (!box) throw new Error("nothing dragable at the chosen point");
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull one corner off the grey circle and show the
  // angle chase. The circles still concur, but P, K and Q no longer line up.
  await drag(corner("B"), 22, -16);
  await page.click("#hint");
  log("corner off the circle:", await text("#status"));
  await shot("first");

  // Second configuration: Reset, then drag the whole quadrilateral. The
  // circle follows A,B,C, so the four corners are cyclic again; reveal the
  // point the Java applet would have labelled K when its shortcut disagrees.
  await page.click("#resetBtn");
  await drag(page.locator("#board .quad"), 26, 14);
  await page.click("#hint");
  await page.click("#showPick");
  log("whole shape dragged:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves; focus must remain on the handle after redrawing.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  for (const id of ["showPick", "hint", "names"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
