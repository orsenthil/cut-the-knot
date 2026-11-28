// Isoperimetric: a demo, so the scenario visits two (and a third) diagrams.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs isoperimetric
export default async ({ page, first, log, shot, idle, text }) => {
  // Configuration 1: the default arcs family, with a break point nudged by
  // keyboard only. The focus must stay on that dot after the redraw.
  log("arcs:", await text("#status"));
  const dot = page.locator('#board [role="button"][aria-label^="Break point 2"]');
  await dot.focus();
  await dot.press("ArrowRight");
  await dot.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  if (first && !focused.startsWith("Break point 2")) {
    log("FOCUS LOST after keyboard moves:", focused);
  }
  log("arcs after moving P2:", await text("#status"));
  await shot("arcs");

  // Configuration 2: six break points, the broken-line family and
  // X-alternate; move its apex with the arrow keys.
  await page.locator('input[name="mode"][value="lines"]').check();
  await page.evaluate(() => {
    const el = document.getElementById("nInput");
    el.value = "6";
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#alternateChk").check();
  const apex = page.locator('#board [role="button"][aria-label^="Top point"]');
  await apex.focus();
  await apex.press("ArrowUp");
  await apex.press("ArrowUp");
  log("lines, 6 points, X-alternate:", await text("#status"));
  await shot("lines-alternate");

  // The freehand family has the extra Y-alternate checkbox; the applet's
  // spline handles move vertically, so nudge the middle one down.
  await page.locator('input[name="mode"][value="spline"]').check();
  await page.locator("#reflectChk").check();
  const splineDot = page.locator('#board [role="button"][aria-label^="Freehand point 11"]');
  await splineDot.focus();
  await splineDot.press("ArrowDown");
  await splineDot.press("ArrowDown");
  log("free hand, Y-alternate:", await text("#status"));
  await shot("freehand");
  await idle();
};
