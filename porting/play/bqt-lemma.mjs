// BQTLemma: set up two different diagrams and look at the shaded areas.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bqt-lemma
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move B and D; E is rebuilt from the parallel rules.
  await drag("B", 34, 0);
  await drag("D", 26, -22);
  log("after moving B and D:", await text("#status"));
  await shot("near-midpoint");

  // Second configuration: start again and move E and C; D is rebuilt instead.
  await page.click("#newBtn");
  await drag("E", -46, 18);
  await drag("C", -24, -12);
  log("after moving E and C:", await text("#status"));
  await shot("off-centre");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and redraws the picture.
  await handle("A").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in the order a player would.
  await page.click("#namesBtn");
  log("names on:", await text("#status"));
  await page.click("#extraBtn");
  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));
  await shot("checked");
  await page.click("#namesBtn");
  await page.click("#extraBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
