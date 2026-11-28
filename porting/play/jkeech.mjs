// Joseph Keech in Bride's Chair: drag C with every option on, then reset and
// drag A and B into a new right triangle. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs jkeech
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
    return handleAt(index);
  };

  // Configuration 1: all three applet options on, C swept round its circle.
  for (const box of ["#namesBox", "#statementBox", "#extraBox"]) await page.click(box);
  const cAfter = await drag(2, { x: 205, y: 160 });
  log("all options on, C swept to", cAfter, "|", await text("#status"));
  await shot("options");

  if (first) {
    // Two arrow-key moves with focus left on the same handle.
    await page.evaluate(() => document.querySelectorAll("#board .geom-handle")[0].focus());
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    const focused = await page.evaluate(() =>
      document.activeElement && document.activeElement.classList.contains("geom-handle") &&
      document.activeElement.getAttribute("aria-label").startsWith("Point A"));
    log("two keyboard moves on A; focus kept:", focused, "|", await text("#status"));
    await shot("keyboard");
  }

  // Configuration 2: reset, then make the triangle long and low with the two
  // other handles. The status still reports the equal sides and 45 degrees.
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  const aAfter = await drag(0, { x: 110, y: 245 });
  const bAfter = await drag(1, { x: 395, y: 220 });
  await page.click("#extraBox");
  await page.click("#namesBox");
  log("A, B moved and extra on; A:", aAfter, "B:", bAfter, "|", await text("#status"));
  await shot("moved");

  // Every option in both directions, then the button a player would press last.
  for (const box of ["#namesBox", "#statementBox", "#extraBox"]) {
    await page.click(box);
    await page.click(box);
  }
  await page.click("#resetBtn");
  log("after pressing every option twice and Reset:", await text("#status"));
};
