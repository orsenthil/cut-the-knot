// Impossible Trinomial: two configurations of the same fork, with the cover
// slid off the picture and then over its middle. No win or loss exists; the
// scenario also makes two keyboard moves, presses every button and visits both
// slider extremes. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs impossible-trinomial
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => document.activeElement && (document.activeElement.id || document.activeElement.tagName));
  const reading = async () => `${await text("#status")} [cover width ${await text("#wValue")}, position ${await text("#dValue")}]`;

  log("initial:", await reading());
  await shot("start");

  // Configuration 1: the cover has slid past the right edge, so the whole
  // fork is visible: two prongs at the left, three round ends at the right.
  await page.locator("#wRange").fill("1");
  await page.locator("#dRange").fill("110");
  log("configuration 1, whole fork:", await reading());
  await shot("whole-fork");

  // Two keyboard moves on a slider; focus must stay on it afterwards.
  await page.focus("#dRange");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after two ArrowLeft presses on the position slider:", await reading(), "| focus:", await focus());
  await shot("keyboard");

  // Every button, in the order a player would press them.
  await page.click("#dMore");
  log("after Slide right:", await reading());
  await page.click("#dLess");
  log("after Slide left:", await reading());
  await page.locator("#wRange").fill("20");
  await page.click("#wMore");
  log("after Wider cover:", await reading());
  await page.click("#wLess");
  log("after Narrower cover:", await reading());
  await page.click("#resetBtn");
  log("after Reset:", await reading());

  // Configuration 2: a wide band hides the middle of the drawing.
  await page.locator("#wRange").fill("60");
  await page.locator("#dRange").fill("30");
  log("configuration 2, wide cover in the middle:", await reading());
  await shot("covered");

  // Both extremes, then values outside the applet's ranges (1..60, 1..110).
  await page.locator("#wRange").fill("1");
  await page.locator("#dRange").fill("1");
  log("minimum sliders:", await reading());
  await shot("minimum");
  await page.locator("#wRange").evaluate((el) => {
    el.value = "999";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("above-range width, clamped to 60:", await reading());
  await page.locator("#dRange").evaluate((el) => {
    el.value = "-40";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  log("below-range position, clamped to 1:", await reading());

  if (!first) return; // the dark run only needs the screenshots above
};
