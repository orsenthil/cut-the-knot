// Colour the Moser Spindle: paint it with 4 colours, then show that 3 is impossible.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs moser-spindle-colouring
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  // paint with a known 4-colouring: click each node (solve gives the colours)
  const sol = await page.evaluate(() => MoserCore.solve(4));
  const nodes = page.locator(".node");
  for (let i = 0; i < 7; i++) for (let t = 0; t <= sol[i]; t++) await nodes.nth(i).click();
  log("painted:", await text("#readout"), "|", await text("#status"));
  await shot("four colours");
  if (!first) return;
  await page.selectOption("#k", "3");
  log("three colours:", await text("#readout"));
  await page.click("#checkBtn");
  log("check:", await text("#status"));
  await shot("three impossible");
  await page.click("#resetBtn");
  log("after clear:", await text("#readout"));
};
