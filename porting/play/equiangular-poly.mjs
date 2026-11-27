// Equiangular Poly is a demo: there is no win or loss to play to. The two
// configurations below are the regular five-gon the applet opens with and a
// pushed-out eight-gon with the hint on and P off centre.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equiangular-poly
export default async ({ page, log, shot, text }) => {
  log("opening five-gon:", await text("#status"));
  await shot("five");

  // The slider goes 3, 4, 5, ... : three ArrowRights take 5 to 8.
  await page.focus("#nRange");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  log("sides shown:", await text("#nValue"));

  await page.check("#hintBox");

  // Slide one side with the keyboard alone, then move P with the keyboard.
  await page.focus("circle.side-handle");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  const sideFocus = await page.evaluate(() => document.activeElement?.getAttribute("class"));
  log("focus after sliding a side:", sideFocus);

  await page.focus("circle.point-handle");
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowDown");
  const pointFocus = await page.evaluate(() => document.activeElement?.getAttribute("class"));
  log("focus after moving P:", pointFocus);

  log("pushed eight-gon with hint:", await text("#status"));
  await shot("eight");
};
