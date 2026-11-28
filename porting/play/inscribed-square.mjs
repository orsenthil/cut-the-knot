// Inscribed Square: a dragged triangle, then the same triangle with P at the
// exact solution. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inscribed-square
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handleAt = (index) => page.evaluate((i) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const drag = async (index, to) => {
    const from = await handleAt(index);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // First configuration: make the triangle tall and move P off the solution.
  // The status reports how far the dangling corner still is from BC.
  await drag(2, { x: 300, y: 70 });
  await drag(3, { x: 250, y: 300 });
  log("after dragging C and P:", await text("#status"), "| P:", await page.inputValue("#pRange"));
  await shot("trial");

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: the solved square, reached with a real button.
  await page.click("#solveBtn");
  log("after Show solution:", await text("#status"), "| P:", await page.inputValue("#pRange"));
  await shot("solved");

  // Keyboard alone: focus P and nudge it; focus must stay on the handle.
  await page.focus("#board .geom-handle:nth-of-type(1)").catch(() => {});
  const p = await handleAt(3);
  await page.evaluate(() => document.querySelectorAll("#board .geom-handle")[3].focus());
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("cx") !== null &&
    document.activeElement?.classList.contains("geom-handle"));
  log("keyboard nudge:", await text("#status"), "| focus kept:", focused, "| P was:", p.x);

  await page.click("#namesBox");
  log("names off:", await page.evaluate(() => [...document.querySelectorAll("#board .pt-label")]
    .every((n) => n.style.display === "none")));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"), "| P:", await page.inputValue("#pRange"));
};
