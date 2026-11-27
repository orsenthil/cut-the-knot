// Pedal Collinearities: a drawing, not a game. Show two configurations —
// every old Show option on with a rotated line, then Reset with a different
// triangle and only the pedal circles shown.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs griffiths-collinearity
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

  // Configuration 1: perpendiculars, circles and names, line rotated at one
  // end and then slid a little with its middle handle.
  await page.click("#perps");
  await page.click("#circles");
  await drag(3, { x: 4, y: 90 });
  await drag(5, { x: 255, y: 205 });
  log("configuration 1:", await text("#status"));
  await shot("all-options");

  // Configuration 2: Reset keeps the options; change the triangle and show
  // only the circles and their common points.
  await page.click("#resetBtn");
  await page.click("#names");
  await page.click("#perps");
  await drag(2, { x: 400, y: 300 });
  await drag(0, { x: 240, y: 70 });
  await drag(4, { x: 496, y: 310 });
  log("configuration 2:", await text("#status"));
  await shot("pedal-circles");

  if (!first) return;
  // Keyboard alone on a triangle corner and a line end; then every checkbox
  // in both directions and one more Reset.
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  const stillFocused = await page.evaluate(() =>
    document.activeElement?.classList.contains("geom-handle"));
  log("keyboard focus kept:", String(stillFocused));
  await page.evaluate(() => document.querySelectorAll("#board .geom-handle")[3].focus());
  await page.keyboard.press("ArrowDown");
  await page.click("#circles");
  await page.click("#circles");
  await page.click("#names");
  await page.click("#names");
  await page.click("#perps");
  await page.click("#perps");
  await page.click("#resetBtn");
  log("after keyboard, toggles and reset:", await text("#status"));
};
