// The Rule of Change of Addends demo: nudge both addends, change the dot limit,
// press Reset, and check that the total always follows the change.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs addition-law-of-change

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  await page.click('.nudge[data-part="a"][data-side="right"]');
  log("after adding to the first addend:", await text("#status"));
  await shot("first-change");

  if (first) {
    // Keyboard: focus a nudge button and activate it with Enter.
    await page.focus('.nudge[data-part="b"][data-side="right"]');
    await page.keyboard.press("Enter");
    log("after a keyboard change:", await text("#status"));
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
    log("focus stayed on:", focused);
    await shot("keyboard");

    await page.fill("#maxInput", "2");
    await page.locator("#maxInput").press("Enter");
    log("dot limit changed:", await page.locator(".dots-more").count(), "overflow labels");
    await shot("dots");
  }

  await page.click(".nudge[data-part='a'][data-side='left']");
  log("after taking one away:", await text("#status"));
  await shot("decrease");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
