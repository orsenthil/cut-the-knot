// Four Squares From Temple: a drawing, not a game. Configuration 1 lines up
// A, B and C by dragging A (which ties C to the same height as in the applet)
// and shows the names and hint. Configuration 2 resets and moves B and C into
// a hinged, off-line position. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs four-squares-from-temple
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const drag = async (i, to) => {
    const from = await handlePos(i);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: the point of the puzzle. Dragging A onto B's height
  // pulls C to the same height, so the one-pixel line test fires.
  await page.click("#names");
  await page.click("#hint");
  const b0 = await handlePos(1);
  await drag(0, { x: 125, y: b0.y });
  log("configuration 1 (lined up):", await text("#status"));
  await shot("lined-up");

  // Configuration 2: back to the start, hint off, and two different hinges.
  await page.click("#resetBtn");
  await page.click("#hint");
  await drag(1, { x: 210, y: 300 });
  await drag(2, { x: 430, y: 430 });
  log("configuration 2 (off the line):", await text("#status"));
  await shot("off-line");

  if (!first) return; // the dark run only needs the screenshots above

  // Keyboard moves keep focus on the handle; toggle both options in both
  // directions and press the only button once more.
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("geom-handle"));
  log("after two arrow keys, focus still on a handle:", focused);
  await page.click("#hint");
  await page.click("#hint");
  await page.click("#names");
  await page.click("#names");
  await page.click("#resetBtn");
  log("after both toggles and reset:", await text("#status"));
};
