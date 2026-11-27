// Directly Similar 1: a drawing, not a game. Two configurations of the two
// squares and P, showing that the third outline stays a square.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs directly-similar-1
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

  // Configuration 1: show the corner names and pull the first square's corner A'
  // up and to the right. The old applet's names were switched off by default.
  await page.click("#namesBox");
  await drag(0, { x: 160, y: 120 });
  log("configuration 1:", await text("#status"));
  await shot("two-squares");

  // Configuration 2: reset, then move P and one corner of the second square.
  await page.click("#newBtn");
  await drag(4, { x: 250, y: 410 });
  await drag(2, { x: 240, y: 300 });
  log("configuration 2:", await text("#status"));
  await shot("another-square");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard-only moves: two arrow steps and a bigger Shift step on A'.
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowUp");
  const focusStayed = await page.evaluate(() =>
    document.activeElement === document.querySelector("#board .geom-handle"));
  log("focus stayed on the board after three key presses:", focusStayed,
    "| A' now at", JSON.stringify(await handlePos(0)));

  // Press every control in the order a player would, in both directions.
  await page.click("#namesBox"); // names off
  await page.click("#namesBox"); // names on
  await page.click("#newBtn");   // back to the starting picture
  log("after reset:", await text("#status"));
};
