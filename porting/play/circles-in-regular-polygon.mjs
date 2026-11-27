// Circles In Regular Polygon: two configurations, with the layers the applet
// offers. There is no win or loss here; finishing means exploring the picture.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-in-regular-polygon
export default async ({ page, first, log, shot, text }) => {
  const boxes = ["#incirclesCheck", "#incentersCheck", "#centroidsCheck", "#bisectorsCheck",
    "#iCircleCheck", "#cCircleCheck", "#tCircleCheck", "#aCircleCheck"];
  const dragA = async (fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const a = await page.locator('[aria-label^="Vertex A"]').boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 10 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // First configuration: six sides, every layer on, A dragged right and up.
  await page.click("#nPlus");
  for (const id of boxes) await page.click(id);
  await dragA(0.74, 0.22);
  log("six sides, all layers:", await text("#status"));
  await shot("six-sides");

  if (first) {
    // Keyboard alone, and focus must stay on A after the redraw.
    await page.locator('[aria-label^="Vertex A"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    log("focus after keyboard:", await page.evaluate(() =>
      document.activeElement && document.activeElement.getAttribute("aria-label")));
    log("after keyboard:", await text("#status"));
    await shot("keyboard");

    // Every checkbox off and back on, then N right down and right up again.
    for (const id of boxes) await page.click(id);
    log("all layers off:", await text("#status"));
    for (const id of boxes) await page.click(id);
    while (!(await page.locator("#nMinus").isDisabled())) await page.click("#nMinus");
    log("N at minimum:", await text("#nValue"));
    while (!(await page.locator("#nPlus").isDisabled())) await page.click("#nPlus");
    log("N at maximum:", await text("#nValue"));
    await shot("max-sides");
  }

  // Second configuration: seven sides, where two of the page's guesses fail.
  const setSides = async (want) => {
    while (Number(await text("#nValue")) > want) await page.click("#nMinus");
    while (Number(await text("#nValue")) < want) await page.click("#nPlus");
  };
  await setSides(7);
  log("seven sides:", await text("#status"));
  await shot("seven-sides");
  log("final:", await text("#status"));
};
