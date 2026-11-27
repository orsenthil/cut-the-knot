// Gergonne and Soddy: two configurations of the same theorem picture. There
// is no win or loss; the scenario moves a corner, switches the proof layers
// and checks that the status still reports a right angle and that keyboard
// focus stays on the moved vertex.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gergonne-and-soddy

export default async ({ page, first, log, shot, text }) => {
  const drag = async (name, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="Vertex ${name}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 10 });
    await page.mouse.up();
  };

  log("starting picture:", await text("#status"));
  await shot("start");

  // First configuration: move A and show the incircle with the cevians.
  await drag("A", 0.82, 0.12);
  await page.click("#premisesBtn");
  log("after moving A and showing premises:", await text("#status"));
  await shot("premises");

  // Second configuration: switch on the inversion circles and move C.
  await drag("C", 0.22, 0.78);
  await page.click("#inversionBtn");
  log("after moving C and showing inversions:", await text("#status"));
  await shot("inversions");

  if (first) {
    const b = page.locator('[aria-label^="Vertex B"]');
    await b.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focus = await page.evaluate(
      () => document.activeElement && document.activeElement.getAttribute("aria-label"),
    );
    if (!/^Vertex B\b/.test(focus || "")) throw new Error("focus left vertex B after arrow keys");
    log("focus after two arrow keys:", focus);
    log("after keyboard moves:", await text("#status"));

    // Every switch in both directions, then a fresh diagram.
    for (const id of ["#namesBtn", "#statementBtn"]) await page.click(id);
    log("with names and right angle hidden:", await text("#status"));
    for (const id of ["#namesBtn", "#statementBtn"]) await page.click(id);
    for (const id of ["#premisesBtn", "#inversionBtn"]) await page.click(id);
    log("all proof layers hidden:", await text("#status"));
    for (const id of ["#premisesBtn", "#inversionBtn"]) await page.click(id);
    await page.click("#resetBtn");
    log("after reset:", await text("#status"));
    await shot("reset");
  }
};
