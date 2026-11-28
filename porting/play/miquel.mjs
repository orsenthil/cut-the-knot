// Miquel: a drawing, not a game. Show two configurations — first three
// circles through a general triangle, then the four circles when the marked
// points are collinear. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs miquel
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

  // Configuration 1: a scalene triangle with its marked points off a line.
  await drag(0, { x: 110, y: 225 });
  await drag(2, { x: 260, y: 45 });
  await drag(3, { x: 230, y: 90 });   // X slides onto the side BC
  await drag(4, { x: 90, y: 130 });   // Y slides onto the side AC
  await page.locator("#board .geom-handle").nth(5).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const zAfterKeys = await handlePos(5);
  const focusName = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("configuration 1:", await text("#status"));
  log("keyboard moved Z to:", JSON.stringify(zAfterKeys), "| focus:", focusName);
  await shot("three-circles");

  // Configuration 2: one straight line through the three marked points, so
  // the red circumcircle joins the three circles at the same point.
  await page.click("#lineUpBtn");
  await idle();
  log("configuration 2:", await text("#status"));
  await shot("four-circles");

  if (!first) return;
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
