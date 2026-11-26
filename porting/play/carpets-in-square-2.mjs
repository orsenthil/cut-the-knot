// Carpets In Square 2: two configurations — the hint picture and the carpet
// picture, then a dragged one. Keyboard, checkboxes and reset are exercised
// on the light run. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs carpets-in-square-2
export default async ({ page, first, log, shot, text }) => {
  const boardBox = await page.locator("#board").boundingBox();
  const dragTo = async (label, x, y) => {
    const h = await page.locator(`#board circle[aria-label^="Point ${label}"]`).boundingBox();
    if (!h || !boardBox) throw new Error(`cannot find handle ${label} or the board`);
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox.x + (x / 450) * boardBox.width,
      boardBox.y + (y / 400) * boardBox.height, { steps: 12 });
    await page.mouse.up();
  };

  // Configuration 1: the applet's opening picture, hint and names on.
  log("opening:", await text("#status"));
  await shot("hint-opening");

  // Configuration 2: untick the hint to see the six red corners and overlap.
  await page.click("#hintBox");
  log("hint off:", await text("#status"));
  await shot("carpets-normal");

  // Move F towards the middle of BC and narrow the outer rectangle.
  await dragTo("F", 405, 200);
  await dragTo("A", 30, 360);
  log("after dragging F and A:", await text("#status"));
  await shot("carpets-moved");

  if (!first) return; // the dark run has both configurations already

  // Two keyboard-only moves on each handle, checking focus is kept.
  await page.locator('#board circle[aria-label^="Point F"]').focus();
  await page.keyboard.press("Shift+ArrowUp");
  await page.keyboard.press("ArrowDown");
  log("F after keys:", await text("#status"));
  log("F focus kept:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));

  await page.locator('#board circle[aria-label^="Point A"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowRight");
  log("A after keys:", await text("#status"));
  log("A focus kept:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));

  await page.click("#namesBox");
  log("names off:", await text("#status"));
  await page.click("#namesBox");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  log("checkboxes after reset:", await page.evaluate(() =>
    [document.getElementById("hintBox").checked,
      document.getElementById("namesBox").checked]));
};
