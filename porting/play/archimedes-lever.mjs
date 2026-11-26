// Archimedes Lever: drag the fulcrum and the weights into two configurations.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs archimedes-lever
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePoint = (index) => page.evaluate((i) => {
    const h = document.querySelectorAll("#board .geom-handle")[i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const drag = async (index, to) => {
    const from = await handlePoint(index);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // First configuration: the red fulcrum is moved to the right of the middle
  // unit, so the heavy left weight tips the beam down.
  await drag(2, { x: 246, y: 170 });
  log("fulcrum dragged right:", await text("#status"));
  await shot("tilted");

  if (!first) return; // the dark run only needs that screenshot

  await page.click("#snapBtn");
  log("after Balance it:", await text("#status"));

  // Second configuration: drag the right weight closer, then put the support
  // back on the new balancing point.
  await drag(1, { x: 255, y: 114 });
  log("right weight dragged left:", await text("#status"));
  await page.click("#snapBtn");
  log("balanced again:", await text("#status"));

  // Change to 6 and 8, tick the largest common unit and try the keyboard.
  for (let i = 0; i < 3; i++) await page.click("#plusP");
  for (let i = 0; i < 4; i++) await page.click("#plusQ");
  await page.click("#gcdBox");
  await drag(2, { x: 170, y: 170 });
  await page.focus("#board .f-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("six and eight, common unit:", await text("#status"),
    "| checkbox:", await page.isChecked("#gcdBox"));
  await shot("six-eight-gcd");
  await page.click("#snapBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
