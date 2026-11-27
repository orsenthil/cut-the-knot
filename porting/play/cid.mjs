// CID: two configurations of the consecutive isosceles decomposition.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cid
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("default (N=9):", await text("#status"));
  await shot("twenty");

  // First configuration: drag the apex down to a shorter, wider triangle.
  await drag("A", 0, 62);
  log("after dragging A:", await text("#status"));
  await shot("dragged");

  // Second configuration: N=5, the golden triangle with two equal steps.
  for (let i = 0; i < 4; i++) await page.click("#minusBtn");
  log("after four - N presses (N=5):", await text("#status"));
  await shot("golden");

  if (!first) return; // the dark run only needs the screenshots above

  // Two arrow-key moves with focus still on the board.
  await corner("B").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  log("with point numbers:", await page.evaluate(() => document.querySelectorAll("#board .num-label").length));
  await page.click("#checkBtn");
  log("after Check the pattern:", await text("#status"));

  await page.click("#plusBtn");
  log("after + N:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
