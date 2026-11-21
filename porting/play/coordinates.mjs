// Coordinates: open the board, set the origin and the unit to their extremes,
// read points in both forms with the cursor traced, drag the handles with the
// pointer, and drive everything with the keyboard alone (the focus must stay on
// the board). No winning or losing here: "Reset" is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs coordinates
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const vals = () => page.evaluate(() => ["oxIn", "oyIn", "unitIn"].map((i) => document.getElementById(i).value).join(", "));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const at = async (x, y) => {
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" })); // clear of the sticky header
    const box = await page.locator("#board").boundingBox();
    return [box.x + (box.width * x) / 360, box.y + (box.height * y) / 360];
  };

  log("initial:", await text("#reading"), "|", await vals());
  await shot("initial");

  // Largest settings: the grid, tracing, complex form, the origin in a corner, the biggest unit.
  await page.check("#gridBox");
  await page.check("#traceBox");
  await page.selectOption("#formatSel", "complex");
  await page.fill("#oxIn", "0"); await page.press("#oxIn", "Tab");
  await page.fill("#oyIn", "360"); await page.press("#oyIn", "Tab");
  await page.fill("#unitIn", "360"); await page.press("#unitIn", "Tab");
  log("all options at maximum:", await text("#status"), "|", await vals());
  await shot("max-options");

  // Back to a friendly board and read a point with the pointer.
  await page.click("#resetBtn");
  await page.selectOption("#formatSel", "complex");
  const [cx, cy] = await at(260, 100);
  await page.mouse.move(cx, cy);
  log("pointer reading in complex form:", await text("#reading"));
  await shot("explored");
  log("done =", await isDone());
  if (!first) return; // the dark run only needs the screenshots above

  // Drag the origin, then the unit handle.
  const [ox, oy] = await at(180, 180);
  const [tx, ty] = await at(120, 240);
  await page.mouse.move(ox, oy); await page.mouse.down(); await page.mouse.move(tx, ty, { steps: 4 }); await page.mouse.up();
  log("after dragging the origin:", await vals());
  const [ux, uy] = await at(120 + 40, 240);
  const [vx, vy] = await at(120 + 80, 240);
  await page.mouse.move(ux, uy); await page.mouse.down(); await page.mouse.move(vx, vy, { steps: 4 }); await page.mouse.up();
  log("after dragging the unit handle:", await vals());
  await shot("dragged");

  // Both ends of every number box.
  await page.fill("#unitIn", "3"); await page.press("#unitIn", "Tab");
  log("unit typed too small:", await text("#status"), "|", await vals());
  await page.fill("#oxIn", "999"); await page.press("#oxIn", "Tab");
  log("origin typed too big:", await vals());

  // Keyboard alone.
  await page.focus("#board");
  await page.keyboard.press("o");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("c");
  await page.keyboard.press("ArrowRight");
  log("after keyboard:", await text("#status"), "| focus =", await focus());
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await vals(), "| done =", await isDone());
  await shot("reset");
};
