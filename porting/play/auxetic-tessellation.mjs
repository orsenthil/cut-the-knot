// Auxetic Tessellation: two configurations of the hinged pattern.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs auxetic-tessellation
export default async ({ page, first, log, shot, idle, text }) => {
  const set = async (id, value) => {
    await page.evaluate(({ id, value }) => {
      const el = document.getElementById(id);
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, { id, value });
  };
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: unequal rectangles, many layers, pulled out of shape.
  await set("alphaInput", 21);
  await set("gammaInput", 5);
  await set("layersInput", 8);
  await page.click("#colorLayers");
  await drag("A", 54, -30);
  await drag("C", -30, 34);
  log("unequal rectangles:", await text("#status"));
  await shot("unequal-rectangles");

  // Second configuration: dancing squares with the hinges locked and opened.
  await page.click("#newBtn");
  await page.click("#oneColor");
  await page.click("#lockHinges");
  await set("alphaInput", 10);
  await set("gammaInput", 10);
  await set("layersInput", 14);
  for (let i = 0; i < 3; i++) await page.click("#stretchBtn");
  log("open squares:", await text("#status"));
  await shot("open-squares");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the moved handle.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button and sweep both sliders to both ends.
  await page.click("#relaxBtn");
  log("after Relax:", await text("#status"));
  await set("alphaInput", 0);
  await set("gammaInput", 0);
  log("sliders at minimum:", await text("#status"));
  await shot("collapsed");
  await set("alphaInput", 21);
  await set("gammaInput", 21);
  log("sliders at maximum:", await text("#status"));
  await set("layersInput", 25);
  log("layers at maximum:", await text("#status"));
  await shot("max-layers");
  await page.click("#newBtn");
  await page.click("#lockHinges");
  log("after Reset:", await text("#status"));
};
