// Circle Square Circle: the exact cupola, then a broken fit with the square turned.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-square-circle
export default async ({ page, first, log, shot, text }) => {
  const status = async () => text("#status");

  // Configuration 1: the page's exact answer on load, applet at its start angle.
  await shot("fit");
  log("exact configuration:", await status());
  log("angle:", await text("#angleOut"));
  if (!first) return; // the dark run only needs the screenshots above

  // Drag G so the small square no longer reaches the quarter curve.
  const g = page.locator("#cupolaBoard .geom-handle").nth(2);
  const box = await g.boundingBox();
  if (!box) throw new Error("handle G is not on the cupola board");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 28, y, { steps: 12 });
  await page.mouse.up();

  // Configuration 2: turn the applet's square to 45 degrees and break the fit.
  await page.click("#angle45Btn");
  await shot("broken");
  log("after dragging G and turning to 45:", await status());
  log("angle after the button:", await text("#angleOut"));

  // The buttons restore both starting states.
  await page.click("#fitBtn");
  await page.click("#resetAppletBtn");
  log("after Show exact fit and Reset applet:", await status());
};
