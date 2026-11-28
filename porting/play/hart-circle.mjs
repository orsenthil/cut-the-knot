// Hart Circle: two arrangements of the three given circles, with the extra
// incircles and the Hart circle shown. An illustration has no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hart-circle
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  // Handles are in DOM order: c1, b1, c2, b2, c3, b3.
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

  // Configuration 1: the applet's +++ base, red incircles and tangency dots.
  await page.click("#addOns");
  await page.click("#tangency");
  await drag(0, { x: 178, y: 216 });
  await drag(2, { x: 252, y: 96 });
  await drag(5, { x: 218, y: 178 });
  log("configuration 1:", await text("#status"));
  await shot("base-plus");
  if (!first) return; // the dark run only needs the screenshot above

  // Configuration 2: a different base triangle and a stretched arrangement.
  // Reset keeps the switches on, as the applet does.
  await page.click("#resetBtn");
  await page.selectOption("#variant", "---");
  await drag(0, { x: 212, y: 210 });
  await drag(4, { x: 148, y: 146 });
  await drag(3, { x: 300, y: 118 });
  log("configuration 2:", await text("#status"));
  await shot("base-minus");

  // The tangency switch must be disabled again when the red circles go off.
  await page.click("#addOns");
  const disabled = await page.evaluate(() => document.getElementById("tangency").disabled);
  log("tangency switch disabled with red circles off:", disabled);
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
