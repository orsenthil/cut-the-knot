// Eppstein: two configurations of the same picture -- the inner Soddy circle
// at the start, then the outer one after moving a corner with the keyboard.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs eppstein
export default async ({ page, first, log, shot, text }) => {
  log("starting picture:", await text("#status"));
  await shot("inner");

  // Two arrow-key nudges on B; Geom keeps focus on the same handle.
  const b = page.locator("#board .geom-handle").nth(1);
  await b.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(
    () => document.activeElement && document.activeElement.getAttribute("aria-label"),
  );
  if (first) log("focus after two arrow keys:", focus);
  if (!/^Point B\b/.test(focus || "")) throw new Error("focus left handle B after arrow keys");

  // The applet's other checkbox: the second solution of Apollonius' problem.
  await page.click("#outerBtn");
  log("outer circle after moving B:", await text("#status"));
  // Let the shared button transition settle so the pressed state is visible.
  await page.waitForTimeout(300);
  await shot("outer");

  if (!first) return;
  await page.click("#innerBtn");
  log("back to inner:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
