// The Quadratic Roots demo: take every slider to both ends, try no roots and
// a double root, use the keyboard, tick both checkboxes and press Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs quadratic-roots

export default async ({ page, log, shot, text }) => {
  const values = async () =>
    (await Promise.all(["a", "b", "c"].map((k) => page.locator(`#value-${k}`).textContent()))).join(" | ");
  const roots = async () => text("#roots");

  log("at the start: a | b | c:", await values(), "|", await roots());
  log("status:", await text("#status"));
  await shot("start");

  // Every option at its maximum, with both display options on.
  for (const key of ["a", "b", "c"]) {
    await page.locator(`#slider-${key}`).focus();
    await page.keyboard.press("End");
  }
  await page.check("#hintBox");
  await page.check("#namesBox");
  log("at maximum:", await values(), "|", await roots());
  log("status at maximum:", await text("#status"));
  await shot("maximum");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator("#slider-b").focus();
  await page.keyboard.press("ArrowLeft");
  let focus = await page.evaluate(() => document.activeElement?.id);
  log("after one ArrowLeft, focus:", focus, "| b:", await page.locator("#value-b").textContent());
  await page.keyboard.press("ArrowRight");
  focus = await page.evaluate(() => document.activeElement?.id);
  log("after one ArrowRight, focus:", focus, "| status:", await text("#status"));
  await shot("keyboard");

  // Both extremes for every slider: minimum and maximum.
  for (const key of ["a", "b", "c"]) {
    await page.locator(`#slider-${key}`).focus();
    await page.keyboard.press("Home");
    log(`${key} at minimum:`, await values(), "|", await roots());
    await page.keyboard.press("End");
    log(`${key} back at maximum:`, await values());
  }
  await shot("extremes");

  // Press the only button and tick/untick both checkboxes.
  await page.click("#resetBtn");
  log("after Reset:", await values(), "|", await roots());
  await page.uncheck("#hintBox");
  await page.uncheck("#namesBox");
  log("display options off; status:", await text("#status"));
  await shot("buttons");

  // A case with no real roots, then one with a double root.
  await page.locator("#slider-a").evaluate((el) => {
    el.value = "1";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  for (const [key, value] of [["b", "1"], ["c", "1"]]) {
    await page.locator(`#slider-${key}`).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  log("a=1 b=1 c=1:", await roots(), "|", await text("#status"));
  await shot("no-roots");

  for (const [key, value] of [["b", "4"], ["c", "4"]]) {
    await page.locator(`#slider-${key}`).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  log("a=1 b=4 c=4:", await roots(), "|", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
