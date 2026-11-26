// Angles In Circle: drag A inside the circle and then outside again.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angles-in-circle
export default async ({ page, first, log, shot, text }) => {
  const aHandle = page.locator('[aria-label^="Point A"]');
  const bHandle = page.locator('[aria-label^="Point on the second secant"]');

  async function drag(locator, dx, dy) {
    const box = await locator.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  }

  // First configuration: A inside the circle, so the arcs are added.
  await drag(aHandle, -104, 0);
  log("A inside:", await text("#status"));
  await shot("inside");

  // Second configuration: A outside, then turn one secant around it.
  await drag(aHandle, 142, 0);
  await drag(bHandle, 0, 20);
  log("A outside:", await text("#status"));
  await shot("outside");

  if (!first) return; // the dark run only needs the two pictures

  // The keyboard must move a focused handle too.
  await bHandle.focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  // Press everything the page offers, in the order a player would.
  for (const id of ["namesBox", "arcsBox", "anglesBox"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  for (const id of ["slide1Back", "slide1Fwd", "slide2Back", "slide2Fwd"]) {
    await page.click(`#${id}`);
  }
  log("after sliding:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
