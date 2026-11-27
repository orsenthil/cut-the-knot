// Four Griffiths: a drawing, not a game. Show two configurations of the same
// cyclic quadrilateral — first with all three old "Show" options on, then
// after Reset with a different quadrilateral and the circles shown alone.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-griffiths
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

  // Configuration 1: every old option on; move B and the line point L.
  await page.click("#names");
  await page.click("#circles");
  await page.click("#lines");
  await drag(1, { x: 455, y: 250 });
  await drag(4, { x: 210, y: 90 });
  log("configuration 1:", await text("#status"));
  await shot("all-options");

  // Configuration 2: Reset keeps the options, so switch two of them off and
  // move C and A; each move puts D back on the circumcircle.
  await page.click("#resetBtn");
  await page.click("#names");
  await page.click("#lines");
  await drag(2, { x: 500, y: 220 });
  await drag(0, { x: 240, y: 110 });
  log("configuration 2:", await text("#status"));
  await shot("pedal-circles");

  if (!first) return;
  // Exercise D (the applet lets it leave the circle), the remaining checkbox
  // in both directions, the keyboard and Reset once more.
  await drag(3, { x: 250, y: 300 });
  log("after dragging D:", await text("#status"));
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowRight");
  await page.click("#circles");
  await page.click("#circles");
  await page.click("#resetBtn");
  log("after keyboard, toggles and reset:", await text("#status"));
};
