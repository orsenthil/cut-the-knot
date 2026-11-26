// Brick Wall: look at two configurations — staggered bricks with thin mortar,
// then a wider wall with a thick mortar band. The illustration has no win or
// loss. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs brick-wall
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}."]`);
  const dragTo = async (name, boardX) => {
    const h = handle(name);
    const box = await h.boundingBox();
    const svg = await page.locator("#board").boundingBox();
    if (!box || !svg) throw new Error(`no handle or board for ${name}`);
    const x = svg.x + (boardX * svg.width) / 400;
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width / 2, y);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 12 });
    await page.mouse.up();
  };
  const setSlider = async (id, value) => {
    await page.locator(`#${id}`).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: about a half-brick shift, with no mortar at all.
  await dragTo("Shift", 244);
  log("staggered:", await text("#status"));
  await shot("staggered");

  // Second configuration: thick mortar and wider bricks, same big shift.
  await dragTo("Mortar", 318);
  await setSlider("widthPct", 20);
  log("mortared:", await text("#status"));
  await shot("mortared");

  if (!first) return; // the dark run only needs the two screenshots

  // Moving the Shift dot with the keyboard alone keeps focus on that dot.
  await handle("Shift").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused.slice(0, 40));
  log("status after keyboard:", await text("#status"));

  // Every slider in both directions, then the only button.
  for (const id of ["widthPct", "heightPct", "shiftPct", "separation", "shadeDiff"]) {
    await setSlider(id, 5);
    await setSlider(id, 100);
  }
  log("after every slider:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  log("reset width:", await page.locator("#widthPctVal").textContent());
};
