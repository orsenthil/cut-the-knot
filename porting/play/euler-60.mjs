// Euler 60: two configurations — a 60 degree angle with the cut on the
// sides, then a 60 degree angle with one side more than twice the other.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euler-60
export default async ({ page, first, log, shot, idle, text }) => {
  // First configuration: apply the 1.2 preset and show all three centres.
  await page.click('[data-sixty="1.2"]');
  for (const centre of ["centroid", "circumcenter", "orthocenter"]) {
    await page.click(`[data-center="${centre}"]`);
  }
  await idle();
  log("60 degrees at B:", await text("#status"));
  log("checkboxes:", await page.evaluate(() =>
    [...document.querySelectorAll("[data-center]")].map((b) => b.checked).join(",")));
  await shot("sixty-cut");

  // Keyboard alone: move B twice, then check it still has focus.
  await page.locator("#board .geom-handle").nth(1).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("after two arrow keys:", await text("#status"));
  log("focus kept:", await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label")));
  if (!first) return; // the dark run only needs the first screenshot

  // Second configuration: one side is more than twice the other, so the
  // equilateral cut lands outside the triangle.
  await page.click('[data-sixty="2.2"]');
  await idle();
  log("long side:", await text("#status"));
  await shot("long-side");

  // And the degenerate case: equilateral, where O and H coincide.
  await page.click('[data-sixty="1"]');
  await idle();
  log("equilateral:", await text("#status"));
};
