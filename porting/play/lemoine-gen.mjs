// Lemoine Gen: explore two configurations of the two walks, one plain and one
// with every option on. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs lemoine-gen
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePoint = (i) => page.evaluate((index) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][index];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const drag = async (index, from, to) => {
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 10 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: drag M off the opening spot, then take six steps. Red
  // and blue are switched on so the two paths are visible in the screenshot.
  await page.click("#redBox");
  await page.click("#blueBox");
  const m0 = await handlePoint(3);
  await drag(3, m0, { x: 118, y: 88 });
  for (let i = 0; i < 6; i++) await page.click("#stepBtn");
  log("six steps:", await text("#status"));
  if (first) {
    const counts = await page.evaluate(() => ({
      red: document.querySelectorAll("#board .walk-red").length,
      blue: document.querySelectorAll("#board .walk-blue").length,
    }));
    log("paths drawn:", JSON.stringify(counts));
    // Animate starts a timer; Stop must leave the walks under manual control.
    await page.click("#runBtn");
    log("animate:", await page.getAttribute("#runBtn", "aria-pressed"));
    await page.click("#runBtn");
    log("stopped:", await page.getAttribute("#runBtn", "aria-pressed"));
  }
  await shot("two-walks");

  // Configuration 2: every box on, a keyboard-only move of corner A, and a
  // fresh run of steps. This is the largest setting at 375px.
  for (const id of ["#connectionsBox", "#centerBox", "#ceviansBox", "#reflectionBox"]) {
    await page.click(id);
  }
  const a0 = await handlePoint(0);
  await drag(0, a0, { x: 78, y: 190 });
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.classList.contains("geom-handle"));
  log("focus after keyboard moves:", focused);
  for (let i = 0; i < 9; i++) await page.click("#stepBtn");
  log("all options:", await text("#status"));
  await shot("all-options");

  if (first) {
    // Every checkbox in both directions, and the reset button at the end.
    await page.click("#redBox");
    await page.click("#redBox");
    await page.click("#centerBox");
    await page.click("#centerBox");
    log("after toggles:", await text("#status"));
    await page.click("#newBtn");
    log("after reset:", await text("#status"));
  }
};
