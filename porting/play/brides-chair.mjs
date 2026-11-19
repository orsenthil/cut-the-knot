// Brides' Chair: the starting figure, every option at its maximum, two keyboard
// moves with a focus check, each button in player order, and both extremes of
// every control. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs brides-chair
export default async ({ page, first, log, shot, text }) => {
  log("initial:", await text("#status"));
  await shot("initial");

  // Every option at its maximum: all four checkboxes and the 0..95 slider.
  await page.click("#namesCheck");
  await page.click("#linesCheck");
  await page.click("#fillCheck");
  await page.click("#mediansCheck");
  await page.locator("#rotationRange").fill("95");
  log("all options at maximum (names, lines, fill, medians, turn 95°):", await text("#status"));
  await shot("max");

  // The slider's 90-degree landmark, where B' lands on C.
  await page.locator("#rotationRange").fill("90");
  log("turn at 90 degrees:", await text("#status"));
  await shot("quarter-turn");

  if (first) {
    // Two keyboard moves on the canvas; focus must stay there after each one.
    await page.locator("#board").focus();
    await page.keyboard.press("3");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
    log("focus after two keyboard moves:", focused);
    log("after keyboard moves (selection and two moves of C):", await text("#status"));
    await shot("keyboard");
  }

  // Every button in the order a player would press them.
  await page.click("#rightBtn");
  log("right-angle button (the big square now equals the two small ones):", await text("#status"));
  await shot("right-angle");
  await page.click("#resetBtn");
  log("reset button (original triangle, slider zero, options off):", await text("#status"));
  await shot("reset");

  // Both extremes of every checkbox, in words.
  for (const [id, name] of [
    ["#namesCheck", "show names"],
    ["#linesCheck", "show lines"],
    ["#fillCheck", "fill triangles"],
    ["#mediansCheck", "show medians/altitudes"],
  ]) {
    await page.click(id);
    log(`${name} ON:`, await text("#status"));
    await page.click(id);
    log(`${name} OFF:`, await text("#status"));
  }

  // The slider's other extreme, then back to the quarter turn for the final view.
  await page.locator("#rotationRange").fill("0");
  log("turn at minimum 0° (flap back at the start):", await text("#status"));
  await page.locator("#rotationRange").fill("95");
  log("turn at maximum 95° (flap past C):", await text("#status"));
  await page.locator("#rotationRange").fill("90");
  await page.click("#mediansCheck");
  log("final (quarter turn with the altitudes shown):", await text("#status"));
  await shot("final");
};
