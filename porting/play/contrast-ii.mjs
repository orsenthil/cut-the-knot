// Contrast II: two configurations of the same-coloured square grids.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs contrast-ii
export default async ({ page, first, log, shot, idle, text }) => {
  const set = async (id, value) => {
    await page.evaluate(({ id, value }) => {
      const el = document.getElementById(id);
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, { id, value });
  };
  const handle = () => page.locator('#board [aria-label^="Fill handle"]');

  await idle("#board .sq");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: the largest grid and the fullest cells, as the
  // play gate asks for every option at its largest value.
  await set("nInput", 10);
  await set("partInput", 100);
  log("10 by 10 at full fill:", await text("#status"));
  await shot("max-grid");

  // Second configuration: the nearly equal case, with the colours swapped.
  await page.click("#resetBtn");
  await set("partInput", 53);
  if (await page.locator("#switchBtn").isChecked()) await page.click("#switchBtn");
  await page.click("#switchBtn");
  log("nearly equal with switched colours:", await text("#status"));
  await shot("waves");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two keyboard moves on the ruler dot; focus must stay on it.
  await handle().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in the order a player would, then sweep both sliders
  // to both ends and back. Disabled buttons are the applet's own limits.
  for (const id of ["#lessN", "#lessN", "#lessPart", "#morePart"]) {
    if (!(await page.locator(id).isDisabled())) await page.click(id);
    log(`after ${id}:`, await text("#status"));
  }
  for (const [id, value] of [["nInput", 2], ["nInput", 10], ["partInput", 0], ["partInput", 100]]) {
    await set(id, value);
    log(`${id} = ${value}:`, await text("#status"));
  }
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await set("partInput", 53);
  await page.click("#switchBtn");
  log("final status class:", await page.locator("#status").getAttribute("class"));
  await shot("explored");
};
