// The Reflection Lemma demo: draw walks, take every slider to both ends,
// use the keyboard, tick Show names and try an unreachable endpoint.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs reflection-principle

export default async ({ page, log, shot, text }) => {
  const values = async () =>
    (await Promise.all(["a", "b", "n"].map((k) => page.locator(`#value-${k}`).textContent()))).join(" | ");

  log("at the start: a | b | n:", await values(), "|", await text("#walkSummary"));
  await page.click("#oneBtn");
  log("after One walk:", await text("#walkSummary"), "|", await text("#status"));
  await shot("one");

  for (const key of ["a", "b", "n"]) {
    await page.locator(`#slider-${key}`).focus();
    await page.keyboard.press("End");
  }
  await page.check("#namesBox");
  log("at maximum:", await values(), "|", await text("#status"));
  await shot("maximum");

  await page.locator("#slider-b").focus();
  await page.keyboard.press("ArrowLeft");
  let focus = await page.evaluate(() => document.activeElement?.id);
  log("after one ArrowLeft, focus:", focus, "| b:", await page.locator("#value-b").textContent());
  await page.keyboard.press("ArrowRight");
  focus = await page.evaluate(() => document.activeElement?.id);
  log("after one ArrowRight, focus:", focus, "| status:", await text("#status"));

  for (const key of ["a", "b", "n"]) {
    await page.locator(`#slider-${key}`).focus();
    await page.keyboard.press("Home");
    log(`${key} at minimum:`, await values(), "|", await text("#status"));
  }
  await shot("minimum");

  for (const [key, value] of [["a", "3"], ["b", "4"], ["n", "9"]]) {
    await page.locator(`#slider-${key}`).evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  }
  await page.click("#oneBtn");
  log("back at the example:", await text("#walkSummary"));
  await shot("example");

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
