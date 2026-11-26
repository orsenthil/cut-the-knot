// Universal Coloring: paint a correct circle, then start over and try the
// largest option. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs universal-coloring
async function paint(page, dots) {
  // Every dot starts at colour 0 and a press adds 1 modulo n.
  for (let i = 0; i < dots.length; i++) {
    for (let c = 0; c < dots[i]; c++) await page.click(`.dot[data-i="${i}"]`);
  }
}

export default async ({ page, first, log, shot, text }) => {
  // A correct colouring: the de Bruijn cycle from the core's Euler tour.
  await page.click("#hintIn");
  const dots = await page.evaluate(() => UniversalColoringCore.solution(4, 0));
  await paint(page, dots);
  log("complete:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("complete");
  if (!first) return; // the dark run only needs the screenshot above

  // Start over, then make a few scattered changes: most pairs are still absent.
  await page.click("#newBtn");
  for (const i of [0, 2, 5, 9, 13]) await page.click(`.dot[data-i="${i}"]`);
  log("wrong colouring:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("wrong");

  // The applet's largest option: 6 colours, 36 dots, both displays, hint on.
  await page.fill("#nIn", "6");
  await page.locator("#nIn").press("Tab");
  await page.click('input[name="show"][value="both"]');
  const big = await page.evaluate(() => UniversalColoringCore.solution(6, 0));
  await paint(page, big);
  log("six colours:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("six-colours");
};
