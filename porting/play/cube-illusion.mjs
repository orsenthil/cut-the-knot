// Cube Illusion: two configurations of the same drawing, plus keyboard play.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cube-illusion
export default async ({ page, first, log, shot, text }) => {
  const setRange = (selector, value) => page.$eval(
    selector,
    (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    },
    String(value),
  );

  // Configuration 1: the extreme settings, with both readings explored.
  await setRange("#angle", 60);
  await setRange("#nSize", 10);
  await setRange("#mSize", 10);
  await page.click("#showSmall");
  await page.click("#showCut");
  log("maximum settings:", await text("#status"), "|", await text("#sizeReadout"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("maximum");

  if (first) {
    // The corner dot keeps focus while the arrow keys change M.
    await page.focus("#board .geom-handle");
    await page.keyboard.press("ArrowLeft");
    const afterLeft = await text("#sizeReadout");
    await page.keyboard.press("ArrowLeft");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("class") || "");
    log("keyboard corner:", afterLeft, "->", await text("#sizeReadout"), "| focus:", focused);
  }

  // Configuration 2: a shallow tilt, a big outer cube, a tiny inner corner.
  await setRange("#angle", 15);
  await setRange("#nSize", 10);
  await setRange("#mSize", 2);
  await page.click("#showSmall");
  log("shallow settings:", await text("#status"), "|", await text("#sizeReadout"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("shallow");
};
