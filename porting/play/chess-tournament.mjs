// Chess Tournament: explore the probability table, then check the controls.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs chess-tournament
export default async ({ page, first, log, shot, text }) => {
  // The page as it opens: defaults p=.55, q=.60, r=.75 and the BC column lit.
  log("initial:", await text("#status"));
  log("initial B row:", await page.locator("#chances tr:nth-child(2) td").allTextContents());
  await shot("initial");

  // Set every option to its maximum; the gate checks that nothing overlaps
  // and that every control stays fingertip-sized at phone width.
  await page.locator("#pSlider").fill("100");
  await page.locator("#qSlider").fill("100");
  await page.locator("#rSlider").fill("100");
  log("all three sliders at maximum:", await text("#status"));
  log("slider labels:", await page.locator("#pValue, #qValue, #rValue").allTextContents());
  await shot("all-max");

  if (!first) return; // the dark run only needs the screenshots above

  // Two keyboard moves on the chart, then check focus stayed on the chart.
  await page.focus("#chart");
  await page.keyboard.press("Home");
  log("after first arrow move:", await text("#status"));
  await page.keyboard.press("ArrowRight");
  log("after second arrow move:", await text("#status"));
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  log("focus after two keyboard moves:", focused);
  await shot("keyboard");

  // Press every button in the order a player would: the three starts, then Reset.
  for (const [id, label] of [["abBtn", "A vs B"], ["bcBtn", "B vs C"], ["acBtn", "A vs C"]]) {
    await page.click("#" + id);
    log(`after choosing ${label} first:`, await text("#status"));
  }
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  log("pressed start after Reset:", await page.locator("#chances").getAttribute("data-focus"));
  await shot("buttons");

  // Both extremes of every option, including values past the scrollbar ends:
  // p below Min clamps to .50, q above Max clamps to 1.00.
  await page.evaluate(() => {
    for (const [id, raw] of [["pSlider", "-40"], ["qSlider", "999"], ["rSlider", "50"]]) {
      const el = document.getElementById(id);
      el.value = raw;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  log("after driving every slider past its ends:", await text("#status"));
  log("clamped labels:", await page.locator("#pValue, #qValue, #rValue").allTextContents());

  await page.evaluate(() => {
    for (const [id, raw] of [["pSlider", "100"], ["qSlider", "50"], ["rSlider", "100"]]) {
      const el = document.getElementById(id);
      el.value = raw;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
  log("after driving the sliders the other way:", await text("#status"));
  log("clamped labels:", await page.locator("#pValue, #qValue, #rValue").allTextContents());
  await shot("extremes");
};
