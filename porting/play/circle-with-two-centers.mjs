// Circle With Two Centers: a fallacy demo, so "done" means the player has
// compared the cheating and honest drawings. Open, push every option to its
// maximum, move a point with the keyboard alone (focus must stay on the board),
// press every control, then make the three points collinear for the dead end.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-with-two-centers
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.getAttribute("data-point") || el.id || el.tagName) : "none";
  });
  const drag = async (from, to) => {
    const box = await page.locator("#board").boundingBox();
    const px = (p) => ({
      x: box.x + p.x / 600 * box.width,
      y: box.y + p.y / 400 * box.height,
    });
    const a = px(from);
    const b = px(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.mouse.up();
  };

  log("initial:", await text("#status"));
  await shot("start");

  // Every option at its maximum: all three boxes checked.
  await page.check("#cheatCheck");
  await page.check("#namesCheck");
  await page.check("#hintCheck");
  log("all options on:", await text("#status"));
  await shot("options-max");

  // Two keyboard-only moves; the focus must stay on point A after each one.
  await page.focus('[data-point="A"]');
  await page.keyboard.press("ArrowRight");
  const f1 = await focus();
  await page.keyboard.press("ArrowDown");
  const f2 = await focus();
  log("two arrow moves:", await text("#status"));
  log("focus after each arrow move:", f1, f2);

  // Switch to the honest drawing: that finishes the exploration.
  await page.uncheck("#cheatCheck");
  log("after comparing both drawings:", await text("#status"));
  await shot("done");

  if (!first) return; // the dark run has the screenshots it needs

  // Press the one button, and take every option both ways.
  await page.click("#resetBtn");
  log("Reset:", await text("#status"));
  await page.uncheck("#namesCheck");
  log("names off:", await text("#status"));
  await page.check("#namesCheck");
  log("names on:", await text("#status"));
  await page.uncheck("#hintCheck");
  log("hint off:", await text("#status"));
  await page.check("#hintCheck");
  log("hint on:", await text("#status"));
  await page.check("#cheatCheck");
  log("cheat on:", await text("#status"));
  await page.uncheck("#cheatCheck");
  log("cheat off:", await text("#status"));

  // Dead end: C onto the line AB. The two rays then make a 180-degree angle,
  // their perpendiculars are parallel and point D no longer exists.
  await drag({ x: 310, y: 80 }, { x: 570, y: 380 });
  log("after a dead end:", await text("#status"));
  await shot("dead-end");
};
