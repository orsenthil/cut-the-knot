// Hinged Tessellation 2: two configurations of the hinged pattern.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hinged-tessellation-2
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

  // First configuration: the page's semi-regular (4,3,3,4,3) start, with
  // more repeating bands and two alternating colours.
  await set("layersInput", 6);
  await page.click("#twoColors");
  log("semi-regular:", await text("#status"));
  await shot("semi-regular");

  // Second configuration: the square derivative at a 90-degree hinge.
  await page.click("#squareBtn");
  await set("layersInput", 2);
  await page.click("#colorLayers");
  log("square derivative:", await text("#status"));
  await shot("square-derivative");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two keyboard moves leave focus on the moved handle.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button and sweep the options to both ends.
  await page.click("#regularBtn");
  log("after Regular:", await text("#status"));
  await set("layersInput", 0);
  log("layers at minimum:", await text("#status"));
  await set("layersInput", 15);
  log("layers at maximum:", await text("#status"));
  await shot("max-layers");
  await page.click("#oneColor");
  await page.click("#lockHinges");
  log("loose hinges:", await text("#status"));
  await drag("A", 24, 18);
  log("after dragging A loose:", await text("#status"));
  await page.click("#lockHinges");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
