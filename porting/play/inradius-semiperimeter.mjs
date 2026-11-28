// Inradius Semiperimeter: show the dissection for two different triangles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs inradius-semiperimeter
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const waitDone = () => idle(() => document.getElementById("status").classList.contains("done"));

  await idle("#board .geom-handle");
  log("start:", await text("#status"));
  await shot("triangle");

  // First configuration: the applet's starting triangle, with its incircle.
  await page.click("#hintBtn");
  log("hint:", await text("#status"), "| pressed =", await page.getAttribute("#hintBtn", "aria-pressed"));
  await page.click("#moveBtn");
  await waitDone();
  log("after Move them:", await text("#status"));
  await shot("rectangle");

  // Second configuration: a different, skewed triangle without the hint.
  await page.click("#resetBtn");
  await page.click("#hintBtn");
  await drag("C", -48, 34);
  await drag("B", -34, -12);
  log("new triangle:", await text("#status"));
  await page.click("#moveBtn");
  await waitDone();
  log("second rectangle:", await text("#status"));
  await shot("skewed-rectangle");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard: two arrow keys on a corner keep focus on that corner.
  await page.click("#resetBtn");
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#moveBtn");
  await page.click("#moveBtn"); // stop part way
  log("stopped:", await text("#status"));
  await page.click("#moveBtn");
  await waitDone();
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
};
