// Directly Similar 2: a drawing, not a game. Two configurations of the two
// similar triangles and P, showing that the third outline keeps its shape.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs directly-similar-2
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

  // Configuration 1: names and hint on, with A' pulled up and left. The
  // matching angles and the pairs of matching links are marked.
  await page.click("#namesBox");
  await page.click("#hintBox");
  await drag(3, { x: 150, y: 210 });
  log("configuration 1:", await text("#status"));
  await shot("two-triangles");

  // Configuration 2: reset, then slide P and one corner of ABC.
  await page.click("#newBtn");
  await drag(5, { x: 410, y: 420 });
  await drag(2, { x: 240, y: 70 });
  log("configuration 2:", await text("#status"));
  await shot("another-triangle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard-only moves: two arrow steps and a bigger Shift step on A'.
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const focusStayed = await page.evaluate(() =>
    document.activeElement === document.querySelector("#board .geom-handle"));
  log("focus stayed on the board after three key presses:", focusStayed,
    "| A now at", JSON.stringify(await handlePos(0)));

  // Press every control in the order a player would, in both directions.
  await page.click("#hintBox"); // hint off
  await page.click("#namesBox"); // names off
  log("with the labels and hint off:", await text("#status"));
  await page.click("#namesBox"); // names on again
  await page.click("#hintBox"); // hint on again
  await page.click("#newBtn"); // back to the starting picture
  log("after reset:", await text("#status"));
};
