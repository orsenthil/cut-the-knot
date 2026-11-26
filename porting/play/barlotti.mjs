// Barlotti: two configurations of the affine-regular polygon and its centres.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs barlotti
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = (id, value) => page.$eval(`#${id}`, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, String(value));
  const handle = (prefix) => page.locator(`#board [aria-label^="${prefix}"]`);
  const drag = async (prefix, dx, dy) => {
    const box = await handle(prefix).boundingBox();
    if (!box) throw new Error(`no handle for ${prefix}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a strongly stretched hexagon, turned by a drag.
  await setRange("a11", 105);
  await setRange("a12", -100);
  await setRange("a21", -100);
  await setRange("a22", 105);
  await drag("First corner", 34, -22);
  log("stretched hexagon:", await text("#status"));
  await shot("stretched");

  if (!first) return; // the dark run only needs the two screenshots

  await page.click("#checkBtn");
  log("after Check the centres:", await text("#status"));

  // Second configuration: reset, then a decagon with the built shapes hidden.
  await page.click("#resetBtn");
  await page.$eval("#nInput", (el) => {
    el.value = "10";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await handle("Opposite corner").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("decagon:", await text("#status"));
  await shot("decagon");

  await page.click("#toggleBtn");
  log("after Hide built shapes:", await text("#status"));
  await page.click("#toggleBtn");
  await page.click("#checkBtn");
  log("after Check the centres:", await text("#status"));
};
