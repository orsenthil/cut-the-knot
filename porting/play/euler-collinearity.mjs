// Euler Collinearity: two illustration configurations. There is no win or
// loss; the screenshots show the slider and the two checkboxes at work.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-collinearity
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 500) * box.width,
    y: box.y + (y / 500) * box.height,
  });
  const drag = async (from, to) => {
    const a = toClient(from[0], from[1]), b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  const setSlider = async (value) => {
    await page.locator("#tSlider").evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  log("initial:", await text("#status"));
  await shot("start");

  // Configuration 1: P on the circumcenter of the nearly equilateral start
  // triangle, with the hint and names on and t = 3. The locus is the Euler line.
  await drag([350, 230], [250, 250]);
  await page.click("#hintBox");
  await page.click("#nameBox");
  await setSlider(30);
  log("config 1:", await text("#status"));
  await shot("config1-euler-line");

  if (!first) return; // the dark run only needs the screenshot above

  // Configuration 2: a skew triangle, P moved away, and every option at its
  // largest value: slider 505 (t = 50.5) plus both checkboxes on.
  await page.click("#resetBtn");
  await drag([250, 83], [120, 70]);
  await drag([394, 333], [420, 180]);
  await drag([106, 333], [80, 400]);
  await drag([350, 230], [200, 320]);
  await page.click("#hintBox");
  await page.click("#nameBox");
  await setSlider(505);
  log("config 2 max:", await text("#status"));
  await shot("config2-max");

  // Keyboard alone: moving a vertex must keep focus on it after the redraw.
  await page.locator("#board circle.vertex-handle").first().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("keyboard:", await text("#status"), "| focus =",
    await page.evaluate(() => document.activeElement.getAttribute("aria-label")?.slice(0, 20)));
  await setSlider(-10);
  log("config 2 min:", await text("#status"));
};
