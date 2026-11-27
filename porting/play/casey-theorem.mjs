// Casey's theorem: a draggable illustration, so "two configurations" stand in
// for a win and a loss. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs casey-theorem
export default async ({ page, first, log, shot, idle, text }) => {
  const point = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await point(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull A and C outside the big circle. Every pair then
  // shows a red outer tangent and the identity still holds.
  await drag("A", 58, -22);
  await drag("C", -34, -38);
  log("after pulling A and C outside:", await text("#status"));
  await shot("outside");

  if (first) {
    await page.click("#checkBtn");
    log("after Check the identity:", await text("#status"));
  }

  // Second configuration: put B and D inside, so dashed inner tangents cross
  // between the two sides while the products stay equal.
  await page.click("#newBtn");
  // Stop short of the centre so B and D keep their places around the circle.
  await drag("B", 30, -18);
  await drag("D", -20, 30);
  // A stays outside while B and D go in: some tangents become inner ones.
  await drag("A", 45, -18);
  log("after pulling B and D inside:", await text("#status"));
  await shot("mixed");

  if (!first) return; // the dark run only needs the two screenshots

  await page.click("#checkBtn");
  log("after Check the identity:", await text("#status"));

  // Keyboard movement keeps focus on the handle after each redraw.
  await point("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
