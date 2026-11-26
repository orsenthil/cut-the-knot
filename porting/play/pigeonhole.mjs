// The Puzzlers' Pigeonhole: five dots always have a pair; the four that work have none.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs pigeonhole
export default async ({ page, first, log, shot, text }) => {
  log("five dots:", await text("#status"));
  await shot("five");
  await page.click("#safeBtn");
  log("four that work:", await text("#status"));
  await shot("four");
  if (!first) return;
  await page.focus("#board .dot >> nth=0");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("after moving a dot with the keyboard:", await text("#status"));
  await shot("moved");
};
