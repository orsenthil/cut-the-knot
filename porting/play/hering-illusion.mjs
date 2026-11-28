// Hering Illusion: two configurations of an illustration with no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hering-illusion
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = async (id, value) => {
    await page.locator(`#${id}`).evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };
  const handle = () => page.locator('#board [aria-label^="Blue band."]');

  await idle("#board .geom-handle");
  log("starting picture:", await text("#status"));
  await shot("default");

  // Second configuration: every option at its largest usable value, which is
  // the widest fan, the biggest gap and the thickest blue bundles.
  await setRange("n", 45);
  await setRange("diff", 195);
  await setRange("width", 29);
  log("all options at maximum:", await text("#status"));
  await shot("max-options");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard moves on the band handle; focus must stay on it.
  await handle().focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowLeft");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused.slice(0, 48));
  log("after keyboard:", await text("#status"));

  // Move every slider in both directions, as a player would.
  for (const [id, values] of [
    ["n", [0, 45, 25]],
    ["diff", [0, 195, 80]],
    ["width", [1, 29, 3]],
  ]) {
    for (const value of values) await setRange(id, value);
  }
  log("after every slider both ways:", await text("#status"));

  // Drag the blue band up and down, then reset with the only button.
  const box = await handle().boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 30, { steps: 8 });
    await page.mouse.up();
    log("after dragging the band:", await text("#status"));
  }
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  log("reset sliders:", await Promise.all(["n", "diff", "width"]
    .map((id) => page.locator(`#${id}`).inputValue())));
};
