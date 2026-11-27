// Dancing Squares: two configurations of the hinged tessellation.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs dancing-squares
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

  // First configuration: every layer, coloured by layer, hinges dragged open.
  await set("layersInput", 15);
  await page.click("#colorLayers");
  await page.click("#showNames");
  await drag("B", 34, -20);
  await drag("A", -22, 18);
  log("coloured layers:", await text("#status"));
  await shot("coloured-layers");

  // Second configuration: one colour, loose hinges, opened to a checkerboard.
  await page.click("#newBtn");
  await page.click("#oneColor");
  await page.click("#showNames");
  await page.click("#lockHinges");
  await set("layersInput", 8);
  for (let i = 0; i < 9; i++) await page.click("#openBtn");
  log("checkerboard:", await text("#status"));
  await shot("checkerboard");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement keeps focus on the moved handle.
  await handle("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button and sweep the layer control to both ends.
  await page.click("#closeBtn");
  log("after Close hinge:", await text("#status"));
  await set("layersInput", 0);
  log("layers at minimum:", await text("#status"));
  await shot("no-layers");
  await set("layersInput", 15);
  log("layers at maximum:", await text("#status"));
  await shot("max-layers");
  await page.click("#newBtn");
  await page.click("#lockHinges");
  log("after Reset:", await text("#status"));
};
