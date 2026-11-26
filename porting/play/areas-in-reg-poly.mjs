// Areas In Reg Poly: a demo, so there is no win or loss to play to. The two
// configurations below are the hexagon the applet opens with and a
// twelve-gon with the hint on and P moved off centre.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs areas-in-reg-poly
export default async ({ page, log, shot, text }) => {
  const firstStatus = await text("#status");
  log("hexagon, centre P:", firstStatus);
  await shot("six");

  // The spinner goes 4, 6, 8, ... : three ArrowRights take 6 to 12.
  await page.focus("#nRange");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  log("sides shown:", await text("#nValue"));

  await page.check("#hintBox");

  // Move P with the keyboard only; focus must stay on the handle afterwards.
  await page.focus("circle.geom-handle");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  const focus = await page.evaluate(() => document.activeElement?.getAttribute("role"));
  log("focus after arrow keys:", focus);

  log("twelve-gon, hint, P off centre:", await text("#status"));
  await shot("twelve");
};
