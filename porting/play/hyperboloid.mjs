// Hyperboloid: two configurations of the same hinged generators.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hyperboloid
export default async ({ page, first, log, shot, text }) => {
  // The outset: no base rotation, so the generators stand as a cylinder.
  log("cylinder:", await text("#status"));
  await shot("cylinder");
  if (!first) return; // the dark run only needs the screenshot above

  // A quarter turn of the top base: the bars now sweep a one-sheet hyperboloid.
  await page.click('[data-preset="hyperboloid"]');
  log("turned:", await text("#status"));
  await shot("hyperboloid");

  // Keyboard control of the accessible dot, then the narrow waist and Solid.
  await page.focus(".geom-handle");
  await page.keyboard.press("ArrowRight");
  log("after an arrow key:", await text("#shiftOut"));
  await page.click('[data-preset="waist"]');
  await page.click("#solidBox");
  log("narrow waist:", await text("#status"));
  await page.click("#newBtn");
  log("after reset:", await text("#status"));
};
