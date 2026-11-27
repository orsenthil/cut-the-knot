// Ellipse Between Circles is a demo, so two configurations stand in for a win
// and a loss: one with a wide inner circle and the third circle above the line,
// another at the far end of the slider where the applet uses its axis fallback.
// Both handles are keyboard-moved, the slider is pushed to both ends, and Reset
// restores the original picture.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ellipse-between-circles
export default async ({ page, first, log, shot, text }) => {
  const setSlider = (value) => page.locator("#slider").evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  const focused = () => page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  const statusClass = () => page.evaluate(() => document.getElementById("status").className);

  log("initial:", await text("#status"));
  await shot("start");

  // Configuration 1: a wide inner circle, the third circle on the upper branch.
  await setSlider(40);
  const c = page.locator('[aria-label^="Point C"]');
  await c.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("configuration 1:", await text("#status"), "|", await statusClass());
  log("after two arrow keys, focus:", await focused());
  await shot("configuration-1");

  // Configuration 2: past the end of the ellipse's horizontal reach.
  await setSlider(100);
  const d = page.locator('[aria-label^="Point D"]');
  await d.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  log("configuration 2:", await text("#status"), "|", await statusClass());
  log("after five arrow keys, focus:", await focused());
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two configuration screenshots

  // Every slider setting in both directions, then the other handle.
  await setSlider(101);
  log("slider at maximum:", await text("#status"));
  await setSlider(0);
  log("slider at minimum:", await text("#status"));
  await setSlider(20);
  await d.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft");
  log("D moved back to the left end:", await text("#status"));

  // Drag C with the pointer as well as the keyboard.
  await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
  const boardBox = await page.locator("#board").boundingBox();
  const handleBox = await c.boundingBox();
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(boardBox.x + boardBox.width * 0.78, handleBox.y + handleBox.height / 2, { steps: 8 });
  await page.mouse.up();
  log("after dragging C:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "|", await statusClass());
  await shot("reset");
};
