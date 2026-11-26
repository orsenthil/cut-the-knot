// Carpets In Square: two configurations (midpoints, then M and N dragged),
// then the names checkbox, keyboard moves and Reset in the light run.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs carpets-in-square
export default async ({ page, first, log, shot, text }) => {
  const boardBox = await page.locator("#board").boundingBox();
  const dragTo = async (label, x, y) => {
    const h = await page.locator(`#board circle[aria-label^="${label}"]`).boundingBox();
    if (!h || !boardBox) throw new Error(`cannot find handle ${label} or the board`);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox.x + (x / 450) * boardBox.width,
      boardBox.y + (y / 400) * boardBox.height, { steps: 12 });
    await page.mouse.up();
  };

  log("configuration 1, both midpoints:", await text("#status"));
  await shot("midpoints");

  await dragTo("Point M", 75, 120);
  await dragTo("Point N", 320, 350);
  log("configuration 2, M near A and N towards C:", await text("#status"));
  await shot("dragged");

  if (!first) return; // the dark run only needs the two configuration shots

  await page.click("#namesBox");
  log("with names shown:", await text("#status"));
  await shot("names");

  await page.locator('#board circle[aria-label^="Point M"]').focus();
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  log("after two arrow keys:", await text("#status"));
  log("focus kept:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
