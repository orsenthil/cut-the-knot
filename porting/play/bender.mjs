// Bender: two configurations of the illusion, then the controls and keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bender
export default async ({ page, first, log, shot, idle, text }) => {
  const setRange = (id, value) => page.evaluate(([sel, v]) => {
    const el = document.getElementById(sel);
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, [id, value]);

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: Gerbino's original, a hexagon with six triangles.
  await page.selectOption("#fixedSel", "6");
  await page.selectOption("#rotSel", "3");
  await setRange("sideInput", 40);
  await setRange("tintInput", 100);
  await page.locator("#shiftInput").setChecked(false);
  for (let i = 0; i < 5; i++) await page.click("#stepBtn");
  log("centred hexagon and triangles:", await text("#status"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("gerbino");

  // Second configuration: the same pair, larger and shifted off the corners.
  await page.click("#resetBtn");
  await page.selectOption("#fixedSel", "6");
  await page.selectOption("#rotSel", "3");
  await setRange("sideInput", 80);
  await setRange("tintInput", 45);
  await page.locator("#shiftInput").setChecked(true);
  for (let i = 0; i < 8; i++) await page.click("#stepBtn");
  log("shifted large triangles:", await text("#status"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("displaced");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard: two arrow keys on each handle, with focus kept by Geom.
  const corner = page.locator('#board [aria-label^="Marked corner"]');
  await corner.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("focus after two arrows on the corner:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));

  const centre = page.locator('#board [aria-label^="Centre of the stationary"]');
  await centre.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrows on the centre:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Every button, in the order a player would press them; sliders both ways.
  await setRange("sideInput", 0);
  await setRange("sideInput", 80);
  await setRange("speedInput", 0);
  await setRange("speedInput", 200);
  await setRange("tintInput", 0);
  await setRange("tintInput", 100);
  await page.selectOption("#fixedSel", "3");
  await page.selectOption("#fixedSel", "6");
  await page.click("#playBtn");
  await page.waitForTimeout(250);
  log("while spinning:", await text("#status"));
  await page.click("#playBtn");
  log("after Stop:", await text("#status"));
  await page.click("#stepBtn");
  await page.click("#checkBtn");
  log("after Check the pattern:", await text("#status"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("checked");
  await page.click("#resetBtn");
  log("after Reset picture:", await text("#status"));
};
