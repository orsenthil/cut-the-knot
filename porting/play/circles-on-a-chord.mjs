// Circles On AChord: a drawing, not a game. Show two configurations of the
// chain of circles and the tangent chord, one at N=3 and one at N=7.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-on-a-chord
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragO = async (to) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: three circles, O below the centre, with names, the hint
  // radius and the dotted Unger circles all showing.
  await page.check("#names");
  await page.check("#hint");
  await page.check("#extra");
  await dragO({ x: 200, y: 190 });
  log("configuration 1:", await text("#status"));
  await shot("three-circles");

  // Configuration 2: the largest chain, O near the top of the big circle.
  await page.click("#resetBtn");
  for (let i = 0; i < 4; i++) await page.click("#moreN");
  await page.check("#extra");
  await dragO({ x: 200, y: 54 });
  log("configuration 2:", await text("#status"));
  await shot("seven-circles");

  // Every control both ways, then two keyboard moves with focus kept on O.
  await page.click("#moreN");
  await page.click("#lessN");
  await page.click("#circles");
  await page.click("#circles");
  await page.click("#names");
  await page.click("#hint");
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+ArrowUp");
  const after = await handlePos();
  await idle();
  log("keyboard moved O:", before.y !== after.y);
  log("focus stays on O:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));

  if (!first) return;
  await page.click("#resetBtn");
  log("reset status:", await text("#status"));
};
