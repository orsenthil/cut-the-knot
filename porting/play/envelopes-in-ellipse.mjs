// Reflections in Ellipse is a demo, so two configurations stand in for a win
// and a loss: a ray that envelopes an ellipse, then one that crosses the
// focal segment and envelopes a hyperbola. The mirror corners and both ray
// points are dragged, every button and Show box is pressed, and two arrow-key
// moves leave focus on the board handle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs envelopes-in-ellipse
export default async ({ page, first, log, shot, text }) => {
  const status = () => text("#status");
  const focused = () => page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  const dragTo = async (handle, p) => {
    const h = await handle.boundingBox();
    const board = await page.locator("#board").boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + (p.x / 400) * board.width,
      board.y + (p.y / 300) * board.height, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await status());
  await shot("start");

  // Configuration 1: the default ray stays clear of the focal segment.
  await page.click("#add10Btn");
  await page.click("#add100Btn");
  await page.check("#namesBox");
  await page.check("#proofBox");
  log("configuration 1, ellipse:", await status());
  await shot("ellipse-envelope");

  // Two keyboard-only moves on T2; focus must stay on the point afterwards.
  const t2 = page.locator('[aria-label^="T2, the first bounce point"]');
  await t2.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("after two arrow keys, focus:", await focused());
  log("after keyboard:", await status());

  // Moving a point recomputes the rays, so add one again before touching the
  // proof box (the applet disables it until a bounce exists).
  await page.click("#addBtn");
  log("one bounce restored:", await status());
  await page.uncheck("#proofBox");
  await page.uncheck("#namesBox");
  await dragTo(t2, { x: 209.4, y: 249.7 });
  log("after second configuration drag:", await status());
  log("Remove all is disabled with no bounces:", await page.locator("#removeAllBtn").isDisabled());
  await page.click("#addBtn");
  log("first bounce in configuration 2:", await status());
  await page.click("#add10Btn");
  await page.click("#add100Btn");
  log("configuration 2, hyperbola:", await status());
  await shot("hyperbola-envelope");

  if (!first) return; // the dark run only needs the two configuration shots

  await page.check("#extendedBox");
  log("extended lines on:", await status());
  await shot("extended-lines");
  await page.uncheck("#extendedBox");
  await page.check("#namesBox");
  await page.check("#proofBox");
  log("proof construction:", await status());

  await page.click("#removeBtn");
  log("after Remove last:", await status());
  await page.click("#removeAllBtn");
  log("after Remove all:", await status(), "| remove disabled:",
    await page.locator("#removeBtn").isDisabled());

  // Drag one mirror corner out and back; the ellipse and all ray points follow.
  const corner = page.locator('[aria-label^="Corner 1 of the mirror rectangle"]');
  await dragTo(corner, { x: 52, y: 244 });
  log("after corner drag:", await status());
  await shot("resized-mirror");

  await page.click("#resetBtn");
  log("after Reset:", await status());
  await shot("reset");
};
