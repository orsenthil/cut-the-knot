// Bulging Lines: two configurations of an illustration with no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bulging-lines
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = () => page.locator('#board [aria-label^="Top layer."]');
  const dragTo = async (boardX, boardY) => {
    const h = handle();
    const box = await h.boundingBox();
    const svg = await page.locator("#board").boundingBox();
    if (!box || !svg) throw new Error("no top-layer handle or board");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(svg.x + (boardX * svg.width) / 400,
      svg.y + (boardY * svg.height) / 360, { steps: 12 });
    await page.mouse.up();
  };
  const setRadius = async (value) => {
    await page.locator("#radius").evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  await idle("#board .geom-handle");
  log("GLWB, layers aligned:", await text("#status"));
  await shot("glwb-aligned");

  // Second configuration: the other named order, biggest dots and a shifted
  // transparent layer. The status must say how far the copy moved.
  await page.selectOption("#order", "GLBW");
  await setRadius(19);
  await dragTo(168, 148);
  log("GLBW, top layer shifted:", await text("#status"));
  await shot("glbw-shifted");

  if (!first) return; // the dark run only needs the two screenshots

  // Two arrow-key moves keep the focus on the draggable dot.
  await handle().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused.slice(0, 45));
  log("after keyboard:", await text("#status"));

  // Every control in both directions, then the only button.
  await setRadius(2);
  await setRadius(19);
  await page.selectOption("#order", "GLWB");
  await page.selectOption("#order", "WGLB");
  log("after every option:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  log("reset order:", await page.locator("#order").inputValue());
  log("reset radius:", await page.locator("#radiusVal").textContent());
};
