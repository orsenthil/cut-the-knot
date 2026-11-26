// Adams' circle demo: drag a corner to one configuration, then to a second
// one with the proof's hint switched on. Check the status still says the six
// points are the same distance from I, and that a keyboard move keeps focus.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs adams-circle

export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Vertex ${name}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 10 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: pull A up and to the right.
  await drag("A", 0.78, 0.18);
  log("after dragging A:", await text("#status"));
  await shot("dragged-a");

  // Second configuration: show the proof's construction and move C.
  await page.click("#hintCheck");
  await drag("C", 0.20, 0.72);
  log("after dragging C:", await text("#status"));
  await shot("dragged-c");

  if (first) {
    await page.locator('[aria-label^="Vertex B"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focused after keyboard moves:", focused);
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // A fresh random triangle, then every option off and back on.
    await page.click("#resetBtn");
    log("new triangle:", await text("#status"));
    for (const id of ["#namesCheck", "#incircleCheck", "#gergonneLinesCheck",
      "#gergonneTriangleCheck", "#adamsCheck", "#hintCheck"]) await page.click(id);
    await shot("minimal");
    for (const id of ["#namesCheck", "#incircleCheck", "#gergonneLinesCheck",
      "#gergonneTriangleCheck", "#adamsCheck", "#hintCheck"]) await page.click(id);
    log("all layers back on:", await text("#status"));
  }

  await shot("final");
};
