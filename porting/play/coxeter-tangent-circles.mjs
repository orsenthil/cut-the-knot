// Coxeter Tangent Circles: a drawing, not a game. Show the second family and
// the six touching points, then drag the centres into two very different
// configurations and switch from the inner to the enclosing circle.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs coxeter-tangent-circles
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePos = (index) => page.evaluate((i) => {
    const h = document.querySelectorAll("#board .geom-handle")[i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const toClient = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (index, toX, toY) => {
    const from = await handlePos(index);
    const a = await toClient(from.x, from.y);
    const b = await toClient(toX, toY);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  await page.check("#secondChk");
  await page.check("#pointsChk");
  await page.check("#fillChk");
  await shot("start");
  log("at the start:", await text("#status"));

  // Configuration 1: move B far right and C low, making an unequal triangle.
  await drag(1, 420, 75);
  await drag(2, 320, 260);
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: the enclosing circle and a mirrored triangle.
  await page.click("label[for='outerRadio']");
  await drag(0, 70, 245);
  await drag(2, 130, 90);
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  // Every option in both directions, and Reset.
  await page.uncheck("#fillChk");
  await page.check("#fillChk");
  await page.uncheck("#secondChk");
  await page.check("#secondChk");
  await page.uncheck("#pointsChk");
  await page.check("#pointsChk");
  await page.click("label[for='innerRadio']");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // Two keyboard-only moves; focus must survive each redraw.
  const before = await handlePos(1);
  await page.locator("#board .geom-handle").nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos(1);
  await idle();
  log("keyboard moved B:", before.x !== after.x || before.y !== after.y);
  log("focus stays on B:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("after keyboard:", await text("#status"));

  if (!first) return;
  log("no win or loss: this is an illustration");
};
