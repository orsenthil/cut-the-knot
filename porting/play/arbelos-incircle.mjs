// Arbelos Incircle: an illustration, so there is no win or loss. Drag the one
// handle into two very different arbeloses, take both screenshots, then check
// the keyboard and Reset. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs arbelos-incircle
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const drag = async (toX) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(toX, from.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  // Configuration 1: a small left half and a large right half.
  await drag(110);
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: reset, then a large left half and a small right half.
  await page.click("#resetBtn");
  await drag(310);
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots above

  // Both display options, in both directions.
  await page.click("#names");
  await page.click("#names");
  await page.click("#guides");
  await page.click("#guides");
  log("after option toggles:", await text("#status"));

  // Keyboard alone: focus C, press two arrow keys, keep focus on the board.
  await page.evaluate(() => document.querySelector("#board .geom-handle").focus());
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  log("after arrow keys:", await text("#status"));
  log("focus kept on C:", await page.evaluate(() =>
    document.activeElement === document.querySelector("#board .geom-handle")));
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
