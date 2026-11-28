// Hjelmslev Theorem: two configurations of the two bars and the mix slider.
// The dots must stay on one diagonal line; no win or loss is possible.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hjelmslev-theorem
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  // Drag the interior of an initial bar: the whole segment should translate.
  const dragSegment = async (which, dx, dy) => {
    const at = await page.evaluate((seg) => {
      const svg = document.getElementById("board");
      const r = svg.getBoundingClientRect();
      const p = seg === 1 ? { x: 216.7, y: 237.7 } : { x: 153, y: 218.1 };
      return { x: r.left + (p.x / 500) * r.width, y: r.top + (p.y / 400) * r.height };
    }, which);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + dx, at.y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const setMix = (value) => page.locator("#rSlider").evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: move one end, slide the whole other bar, set r = 0.25.
  await drag("A1", 35, -28);
  await dragSegment(2, -22, 14);
  await setMix(0.25);
  await page.click("#checkBtn");
  log("first configuration:", await text("#status"));
  await shot("r-025");

  if (!first) return; // the dark run only needs the two screenshots

  // Second configuration: reset, equal lengths, move A2, fix the dragged bar,
  // then set r = 0.75 and check the claim again.
  await page.click("#newBtn");
  await page.click("#equalBtn");
  await drag("A2", -55, -24);
  await page.click("#fixBtn");
  await drag("B1", 28, -40);
  await setMix(0.75);
  await page.click("#checkBtn");
  log("second configuration:", await text("#status"));
  await shot("equal-fixed-r-075");

  // Keyboard movement keeps focus on the handle; the picture follows.
  await handle("B2").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in player order and flip each switch both ways.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#equalBtn");
  await page.click("#equalBtn");
  await page.click("#fixBtn");
  await page.click("#fixBtn");
  await page.click("#checkBtn");
  log("after all buttons:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
