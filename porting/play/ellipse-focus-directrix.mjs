// Ellipse Focus Directrix: two shapes of the same ellipse, with the focus on
// different axes. There is no win or loss: this is an illustration.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ellipse-focus-directrix
export default async ({ page, first, log, shot, text }) => {
  // A wide ellipse: the focus is on the left, the directrix is vertical.
  await page.click('[data-preset="wide"]');
  const wide = await text("#status");
  log("wide:", wide, "PF / PD =", await text("#ratioOut"));
  await shot("wide");

  // A tall ellipse: the focus moves to the bottom, the directrix is horizontal.
  await page.click('[data-preset="tall"]');
  await page.click("#otherBtn"); // show the page's second pair as a dashed guide
  const tall = await text("#status");
  log("tall:", tall, "PF / PD =", await text("#ratioOut"));
  await shot("tall");

  if (!first) return; // the dark run only needs the two screenshots above

  // Slide P with the keyboard alone; the ratio must stay fixed.
  await page.locator(".p-handle").focus();
  const before = await text("#ratioOut");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  const after = await text("#ratioOut");
  log("P after three ArrowRight presses: PF / PD", before, "->", after,
    "| focus kept:", await page.evaluate(() => document.activeElement?.classList.contains("p-handle")));

  // The near-circle early return, then Reset.
  await page.click('[data-preset="circle"]');
  log("almost a circle:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"), "PF / PD =", await text("#ratioOut"));
};
