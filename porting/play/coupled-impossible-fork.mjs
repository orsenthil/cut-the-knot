// Coupled Impossible Fork: two configurations of the coupled frame.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs coupled-impossible-fork
export default async ({ page, first, log, shot, text }) => {
  // The applet's default: W = 500, so the middle beams meet exactly.
  log("joined frame:", await text("#status"));
  await shot("joined");
  if (!first) return; // the dark run only needs the screenshot above

  // The page's third applet used LessReal = 1; at W = 250 its gap and the
  // revealed rear edges are both visible.
  await page.click('[data-preset="gap"]');
  await page.click("#lessBtn");
  log("gap, rear edges shown:", await text("#status"));
  await shot("gap");
};
