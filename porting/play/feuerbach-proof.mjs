// Feuerbach Proof: a proof diagram, not a game. Show both optional circles,
// then drag the triangle into two very different configurations. The status
// line reports the radii and the inverse pair; there is no win or loss.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs feuerbach-proof
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

  await page.check("#inversionChk");
  await page.check("#nineChk");
  await shot("start");
  log("at the start:", await text("#status"));

  // Configuration 1: a tall, slanted triangle whose second tangent and the
  // inverse point S both stay on the board.
  await drag(1, 80, 230);
  await drag(2, 240, 140);
  await drag(0, 180, 70);
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: a mirrored, taller triangle with names and angles off,
  // leaving only the tangency picture.
  await page.uncheck("#namesChk");
  await page.uncheck("#anglesChk");
  await drag(0, 330, 35);
  await drag(1, 40, 215);
  await drag(2, 290, 230);
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  // Every option in both directions, then Reset.
  for (const id of ["namesChk", "inversionChk", "nineChk", "anglesChk"]) {
    await page.uncheck("#" + id);
    await page.check("#" + id);
  }
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
  log("no win or loss: this proof diagram cannot be finished");
};
