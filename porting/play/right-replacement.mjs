// The Right Replacement demo: run each comparison, take the length to its
// extremes, press every button, and make a row by hand with the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs right-replacement

export default async ({ page, log, shot, text }) => {
  const values = async () => (await page.locator("#values .num").allTextContents()).join(" ");
  const lastRows = async (count = 4) =>
    (await page.locator("#rows .cells").allTextContents()).slice(-count).join(" / ");
  const rowsCount = async () => page.locator("#rows .calc-row").count();

  log("at the start:", await values(), "| status:", await text("#status"));
  await shot("start");

  await page.click("#computeBtn");
  log("after Compute:", await rowsCount(), "rows, last ones:", await lastRows());
  log("status says:", await text("#status"));
  await shot("computed");

  // Every option at its maximum: forty numbers must slide inside the stage.
  for (let i = 0; i < 30; i++) await page.click("#lengthUp");
  log("maximum length:", await page.inputValue("#lengthInput"),
    "numbers, stage scroll:", await page.evaluate(() => {
      const e = document.querySelector("#stage .scroll");
      return e.scrollWidth - e.clientWidth;
    }));
  await page.click("#computeBtn");
  await shot("maximum");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator("#values .num").nth(1).focus();
  await page.keyboard.press("ArrowRight");
  let focus = await page.evaluate(() => document.activeElement?.className + ":" + document.activeElement?.dataset.index);
  log("after one ArrowRight, focus:", focus, "| number 2:", await page.locator("#values .num").nth(1).textContent());
  await page.keyboard.press("ArrowLeft");
  focus = await page.evaluate(() => document.activeElement?.className + ":" + document.activeElement?.dataset.index);
  log("after one ArrowLeft, focus:", focus, "| status:", await text("#status"));
  await shot("keyboard");

  // Press every button the page has, in a player's order, and every radio.
  await page.click("#lengthDown");
  await page.click("#lengthUp");
  for (const type of ["LE", "GT", "GE", "LT"]) {
    await page.click(`label:has(#type-${type})`);
    log(`${type}:`, await rowsCount(), "rows |", await text("#status"));
  }
  await page.click("#computeBtn");
  await page.click("#resetBtn");
  log("after Reset:", await values(), "|", await text("#status"));
  await shot("buttons");

  // Both extremes of the length spinner: below the minimum and above the max.
  for (const value of ["1", "100"]) {
    await page.fill("#lengthInput", value);
    await page.press("#lengthInput", "Tab");
    log(`length entered as ${value} follows the applet and shows`, await page.inputValue("#lengthInput"));
  }
  await shot("extremes");

  // Build the page's worked row by lowering each number with ArrowLeft.
  await page.fill("#lengthInput", "4");
  await page.press("#lengthInput", "Tab");
  for (let i = 0; i < 4; i++) {
    const button = page.locator("#values .num").nth(i);
    await button.focus();
    for (let n = Number(await button.textContent()); n > i + 1; n--) {
      await page.keyboard.press("ArrowLeft");
    }
  }
  log("the row by hand:", await values());

  await page.click("label:has(#type-LE)");
  log("LE last rows:", await lastRows(), "| status:", await text("#status"));
  await shot("LE");

  await page.click("label:has(#type-GE)");
  log("GE last rows:", await lastRows(), "| status:", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
