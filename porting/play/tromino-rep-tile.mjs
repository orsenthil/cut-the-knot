// Tromino as a Rep-tile: largest board at phone width, click a hole, follow the
// splits to a full unit tiling, step past the end, place the hole with the
// keyboard, then reset.
export default async ({ page, first, log, shot, text }) => {
  await page.selectOption("#expInput", "7");
  log("largest board:", await text("#line"));
  log("start:", await text("#status"));
  await shot("max-size");

  const box = await page.locator("#board").boundingBox();
  await page.mouse.click(box.x + box.width * 0.25, box.y + box.height * 0.25);
  log("after placing the hole:", await text("#status"));

  for (let i = 0; i < 6; i++) await page.click("#stepBtn");
  log("after the whole proof:", await text("#line"));
  log("status:", await text("#status"));
  await shot("done");

  await page.click("#stepBtn"); // one past the end restarts with the same hole
  log("after stepping past the end:", await text("#line"));
  log("status:", await text("#status"));
  if (!first) return; // the dark run only needs the screenshot above

  await page.focus("#board");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("after keyboard hole:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
