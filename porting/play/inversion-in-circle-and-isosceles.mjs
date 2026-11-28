// Inversion in a circle and an isosceles triangle: a drawing, not a game.
// Move B to two configurations, read the claim off the status line, and press
// every toggle and step.
// Run with: export NODE_PATH=$(npm root -g)
//           node porting/play.mjs inversion-in-circle-and-isosceles
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);
  const dragB = async (toX) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(toX, from.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");

  // Configuration 1: B to the right of centre, with W touching all three
  // objects. Show the right angle and the inverted picture.
  await dragB(240);
  await page.click("#statementBtn");
  await page.click("#inversionBtn");
  log("configuration 1:", await text("#status"));
  await shot("right-of-centre");

  // Configuration 2: B to the left of centre; show the names and walk through
  // the five proof steps, one button at a time.
  await dragB(170);
  await page.click("#namesBtn");
  for (let i = 1; i <= 5; i++) {
    await page.click("#step" + i + "Btn");
    log("step " + i + ":", await text("#status"));
  }
  log("configuration 2:", await text("#status"));
  await shot("steps-complete");

  // Press the remaining buttons and take every option both ways.
  await page.click("#premiseBtn");
  await page.click("#premiseBtn");
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#inversionBtn");
  await page.click("#step0Btn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // Two keyboard-only moves, keeping focus on B.
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos();
  await idle();
  log("keyboard moved B:", before.x !== after.x);
  log("focus stays on B:", await page.evaluate(() =>
    !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("final status:", await text("#status"));
  if (!first) return;
  await shot("keyboard");
};
