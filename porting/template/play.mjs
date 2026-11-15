// TODO(port): {{TITLE}}: play to a win, then to a loss or a dead end.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs {{SLUG}}
export default async ({ page, first, log, shot, idle, text }) => {
  // TODO(port): make the winning moves, e.g. await page.click("...");
  log("after a win:", await text("#status"));
  await shot("win");
  if (!first) return; // the dark run only needs the screenshot above

  await page.click("#newBtn");
  // TODO(port): make losing or impossible moves.
  log("after a loss:", await text("#status"));
  await shot("loss");
};
