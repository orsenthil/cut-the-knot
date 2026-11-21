// Complex Numbers: open the plane, push every option to its extreme, drag the
// dots under each fix and show choice, type values past both ends of the
// range, and drive the plane with the keyboard alone (the focus must stay on
// the canvas). The demo has no win or loss; "Reset" is its second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs complex-numbers
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const vals = () => page.evaluate(() => ["axA", "ayA", "axB", "ayB"].map((i) => document.getElementById(i).value).join(", "));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const drag = async (fx, fy, tx, ty) => {
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" })); // clear of the sticky header
    const box = await page.locator("#board").boundingBox();
    const pt = (x, y) => [box.x + (box.width * (200 + 20 * x)) / 400, box.y + (box.height * (150 - 20 * y)) / 300];
    const [x0, y0] = pt(fx, fy), [x1, y1] = pt(tx, ty);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2);
    await page.mouse.move(x1, y1);
    await page.mouse.up();
  };

  log("initial:", await text("#status"), "|", await vals());
  await shot("initial");

  // Every option in turn, then the largest dragging range (corners of the board).
  for (const m of ["conjugate", "sum", "common", "real", "complex"]) {
    await page.check(`input[name=mode][value=${m}]`);
    log("show", m + ":", await text("#status"));
  }
  await page.check("input[name=mode][value=common]");
  await page.check("input[name=fix][value=radius]");
  await drag(1, 1.732, -1.5, 1.5);
  await drag(-1.148, 2.772, 2.5, 2);
  log("fixed absolute value, dragged:", await text("#status"), "|", await vals());
  await shot("fixed-radius");

  await page.check("input[name=fix][value=angle]");
  await drag(-1.5, 1.5, -9, 9);
  log("fixed angle, dragged far:", await vals(), "| done =", await isDone());
  await shot("explored");
  if (!first) return; // the dark run only needs the screenshots above

  // Free hand, typed values past both ends of the range.
  await page.check("input[name=fix][value=free]");
  await page.fill("#axA", "99"); await page.press("#axA", "Tab");
  await page.fill("#ayB", "-99"); await page.press("#ayB", "Tab");
  log("typed 99 and -99:", await vals());
  await shot("typed");

  // Keyboard alone: focus the canvas, pick B, two arrow presses.
  await page.focus("#board");
  await page.keyboard.press("b");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  log("after keyboard:", await text("#status"), "| focus =", await focus());
  await shot("keyboard");

  await page.click("#newBtn");
  log("after Reset:", await vals(), "| done =", await isDone());
  await shot("reset");
};
