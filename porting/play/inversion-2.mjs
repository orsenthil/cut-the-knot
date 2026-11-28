// Inversion 2: a picture, so two different configurations instead of a win
// and a loss. Drag the points, move one with the keyboard, and show the labels.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inversion-2
export default async ({ page, first, log, shot, idle, text }) => {
  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const client = (p) => page.evaluate((q) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * q.x + m.c * q.y + m.e, y: m.b * q.x + m.d * q.y + m.f };
  }, p);

  const drag = async (i, to) => {
    const from = await handlePos(i);
    const a = await client(from);
    const b = await client(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: show the labels, swing C around t and move A; A' follows
  // onto the same outlined circle. Handles are O, R, C, A in that order.
  await page.click("#names");
  await drag(2, { x: 300, y: 92 });
  await drag(3, { x: 330, y: 108 });
  log("configuration 1:", await text("#status"));
  await shot("negative-power");
  if (!first) return; // the dark run only needs the first screenshot

  // Two keyboard moves on A: focus must stay on the same handle afterwards.
  await page.locator("#board .geom-handle").nth(3).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(() =>
    [...document.querySelectorAll("#board .geom-handle")]
      .indexOf(document.activeElement));
  log("keyboard focus after two moves: handle", focus);
  log("after keyboard:", await text("#status"));

  // Configuration 2: reset, then shrink and move t so C, A and A' all change.
  await page.click("#resetBtn");
  await drag(0, { x: 232, y: 138 });
  await drag(1, { x: 198, y: 138 });
  await drag(2, { x: 250, y: 96 });
  await drag(3, { x: 244, y: 198 });
  log("configuration 2:", await text("#status"));
  await shot("moved-centre");

  // Every control both ways, then back to the opening picture.
  await page.click("#names");
  log("labels off:", await text("#status"));
  await page.click("#names");
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
