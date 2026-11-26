// The Random Walk demo: send one and ten walks, take every slider to both
// ends, use the keyboard and tick Show names.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs random-walk

export default async ({ page, log, shot, text }) => {
  const values = async () =>
    (await Promise.all(["a", "b", "n"].map((k) => page.locator(`#value-${k}`).textContent()))).join(" | ");

  log("at the start: a | b | n:", await values(), "|", await text("#walkList"));
  log("status:", await text("#status"));
  await page.click("#oneBtn");
  log("after One walk:", await text("#walkList"), "|", await text("#status"));
  await shot("one");
  await page.click("#tenBtn");
  log("after Ten walks:", await text("#walkList"), "|", await text("#status"));
  await shot("ten");

  // Every option at its maximum, then its minimum, with names shown.
  for (const key of ["a", "b", "n"]) {
    await page.locator(`#slider-${key}`).focus();
    await page.keyboard.press("End");
  }
  await page.check("#namesBox");
  log("at maximum:", await values(), "|", await text("#walkList"));
  log("status at maximum:", await text("#status"));
  await shot("maximum");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator("#slider-n").focus();
  await page.keyboard.press("ArrowLeft");
  let focus = await page.evaluate(() => document.activeElement?.id);
  log("after one ArrowLeft, focus:", focus, "| n:", await page.locator("#value-n").textContent());
  await page.keyboard.press("ArrowRight");
  focus = await page.evaluate(() => document.activeElement?.id);
  log("after one ArrowRight, focus:", focus, "| status:", await text("#status"));

  for (const key of ["a", "b", "n"]) {
    await page.locator(`#slider-${key}`).focus();
    await page.keyboard.press("Home");
    log(`${key} at minimum:`, await values(), "|", await text("#walkList"));
  }
  await shot("minimum");

  // Try a reachable and an unreachable pair of endpoints.
  for (const [key, value] of [["a", "1"], ["b", "1"], ["n", "6"]]) {
    await page.locator(`#slider-${key}`).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  await page.click("#tenBtn");
  log("a=1 b=1 n=6:", await text("#walkList"), "|", await text("#status"));
  await shot("reachable");

  await page.locator("#slider-b").evaluate((el) => {
    el.value = "-10";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.click("#oneBtn");
  log("unreachable end:", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await page.uncheck("#namesBox");
  await shot("final");
};
