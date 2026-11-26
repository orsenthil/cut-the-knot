// Barycentric: two configurations of the triangle and P, with every option used.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs barycentric
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // Configuration 1: P off-centre, all three readouts on, inherited ratios.
  await drag("Point P", 46, -26);
  await page.click("#namesBtn");
  await page.click("#baryBtn");
  await page.click("#cevaBtn");
  log("inherited:", await text("#status"));
  await shot("inherited");

  // Configuration 2: a different triangle, P outside it, "add to 1" labels.
  await page.click("#newBtn");
  await drag("Corner B", -64, 12);
  await drag("Corner C", 34, -22);
  await drag("Point P", -88, 62);
  await page.click("#modeAdd");
  await page.click("#checkBtn");
  log("outside:", await text("#status"));
  await shot("outside");

  if (!first) return; // the dark run only needs the two screenshots

  // Every mode and the digit spinner, in both directions, at the applet's range.
  await page.click("#modeRouth");
  log("a la Routh:", await text("#status"));
  await page.click("#digitsUp");
  await page.click("#digitsUp");
  log("digits up:", await text("#digitsValue"), await text("#status"));
  await page.click("#digitsDown");
  await page.click("#digitsDown");
  await page.click("#digitsDown"); // stops at the applet's minimum of 1
  log("digits down:", await text("#digitsValue"));
  await page.click("#digitsDown");
  log("digits at minimum:", await text("#digitsValue"));

  // Keyboard movement keeps focus on the handle; the picture follows.
  await handle("Point P").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#namesBtn");
  await page.click("#baryBtn");
  await page.click("#cevaBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
