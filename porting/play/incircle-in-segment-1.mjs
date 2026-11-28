// Incircle In Segment 1: two configurations of a geometry illustration.
// There is no win or loss; each screenshot shows the radical axis through M.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs incircle-in-segment-1
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move both contacts so the two circles cross, and
  // switch on the applet's Hint (tangents, circle through M, construction lines).
  await drag("Circle touch point C", 15, 0);
  await drag("Circle touch point D", -15, 0);
  await page.click("#hintChk");
  log("first shape:", await text("#status"));
  await shot("first");

  // Second configuration: turn the chord, move a contact, and turn Hint off.
  await drag("Chord endpoint A", 44, -34);
  await drag("Circle touch point D", 12, 0);
  await page.click("#hintChk");
  log("second shape:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: the focus must stay on the moved handle.
  await handle("Circle touch point C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in a player's order, in both directions.
  await page.click("#hintChk");
  await page.click("#hintChk");
  await page.click("#newBtn");
  await page.click("#resetBtn");
  log("after New diagram and Reset:", await text("#status"));
};
