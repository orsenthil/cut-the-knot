// Four Incident Circles: an illustration, so there is no win or loss. Drag the
// centres into two different configurations, with names and then with the hint,
// and take a screenshot of each.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-incident-circles
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
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: move two centres around the common point, names on.
  await page.click("#names");
  await drag(0, { x: 318, y: 331.6 });
  await drag(2, { x: 249.2, y: 165.4 });
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: reset, show the hint, then make a different quadrilateral.
  await page.click("#resetBtn");
  await page.click("#names"); // off
  await page.click("#hint");  // on
  await drag(1, { x: 230, y: 336.6 });
  await drag(3, { x: 366.6, y: 200 });
  await page.locator("#board .geom-handle").nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("class"));
  log("configuration 2:", await text("#status"));
  log("focus after two arrow keys:", focus);
  await shot("configuration-2");

  if (!first) return;
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
