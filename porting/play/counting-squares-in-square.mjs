// Counting Squares in a Square: open the board, set N and M to their extremes,
// sweep the small square over every place until each is painted, try both ends
// of the boxes (and an M bigger than N), and use the arrow keys with the focus
// kept on the picture. No win or loss here: "Reset" is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs counting-squares-in-square
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const vals = () => page.evaluate(() => ["nIn", "mIn"].map((i) => document.getElementById(i).value).join(", "));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const set = async (id, v) => { await page.fill("#" + id, String(v)); await page.press("#" + id, "Tab"); };
  const drag = async (x0, y0, x1, y1) => { // in cells, relative to the board's top left corner
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" })); // clear of the sticky header
    const box = await page.locator("#board").boundingBox();
    const n = Number(await page.inputValue("#nIn"));
    const px = (u, v) => [box.x + (box.width * (u + 1.5)) / (n + 3), box.y + (box.height * (v + 1.5)) / (n + 3)];
    const [a, b] = px(x0, y0), [c, d] = px(x1, y1);
    await page.mouse.move(a, b); await page.mouse.down(); await page.mouse.move((a + c) / 2, (b + d) / 2); await page.mouse.move(c, d); await page.mouse.up();
  };

  log("initial:", await text("#readout"), "|", await vals());
  await shot("initial");

  // Everything at its largest.
  await set("nIn", 40); await set("mIn", 40);
  log("all options at maximum:", await text("#readout"), "|", await vals());
  await shot("max-options");

  // A friendly board: sweep the 2 x 2 square over a 4 x 4 grid, place by place.
  await set("mIn", 2); await set("nIn", 4);
  await drag(2.4, 2.4, 1.4, 2.4); // one pointer drag, grabbing the square near its upper left cell
  await page.click("#resetBtn"); // back in the lower right corner, then walk every place with the arrow keys
  await page.focus("#board");
  for (const k of ["ArrowLeft", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowRight", "ArrowUp", "ArrowLeft", "ArrowLeft"]) await page.keyboard.press(k);
  log("swept:", await text("#status"), "| done =", await isDone());
  await shot("explored");
  if (!first) return; // the dark run only needs the screenshots above

  // Both ends of the boxes, and M bigger than N.
  await set("nIn", 0); log("N typed 0:", await text("#status"), "|", await vals());
  await set("mIn", 99); log("M typed 99:", await text("#readout"), "|", await vals());
  await set("mIn", 7); await set("nIn", 3); log("N lowered below M:", await vals());
  await shot("clamped");

  // Keyboard alone, from a fresh board.
  await page.click("#resetBtn");
  await set("nIn", 5); await set("mIn", 3);
  await page.focus("#board");
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowUp");
  log("after keyboard:", await text("#status"), "| focus =", await focus());
  await shot("keyboard");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| done =", await isDone());
  await shot("reset");
};
