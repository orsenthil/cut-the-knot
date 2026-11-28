// Two configurations of Two Circles and One More: the page's arrangement,
// then Q dragged past the line LP so the half-angle becomes its supplement.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs max-common-chord-4
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (from, to) => {
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  // First configuration: the arrangement the cut-the-knot page describes.
  await page.click("#statement1Box");
  await page.click("#statement2Box");
  log("drawn arrangement:", await text("#status"));
  await shot("drawn-arrangement");

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: move Q to the other arc of chord LP.
  await drag({ x: 200, y: 240 }, { x: 360, y: 260 });
  await page.click("#hintBox");
  await page.click("#namesBox");
  log("Q on the small arc:", await text("#status"));
  await shot("small-arc");

  // Keyboard-only nudge of Q; the handle must keep focus after each redraw.
  await page.focus("#board .geom-handle:nth-of-type(2)");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focused);
  log("after keyboard nudges:", await text("#status"));

  // Reset returns the four points to the applet's starting positions.
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
