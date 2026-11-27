// Cosine Law: illustrate the obtuse start, then drag B into an acute triangle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cosine-law
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 600) * box.width,
    y: box.y + (y / 440) * box.height,
  });
  const drag = async (from, to) => {
    const a = toClient(from[0], from[1]);
    const b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };

  // Configuration 1: the applet's starting triangle is obtuse at C.
  await page.check("#colorsChk");
  await page.check("#namesChk");
  log("obtuse:", await text("#status"), "|", await text("#readout"));
  await shot("config1-obtuse");

  // Configuration 2: pull B down until angle C becomes acute.
  await drag([231.43, 313.33], [231.43, 380]);
  log("acute:", await text("#status"), "|", await text("#readout"));
  await shot("config2-acute");

  if (!first) return;

  // The keyboard must move a point without taking focus off the board.
  await page.locator('circle[aria-label^="Point C"]').focus();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  log("keyboard:", await text("#status"), "| focus:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label")?.slice(0, 24)));
  await shot("keyboard");

  // Press Reset and switch both checkboxes the other way.
  await page.click("#resetBtn");
  await page.uncheck("#colorsChk");
  await page.uncheck("#namesChk");
  log("reset:", await text("#status"), "|", await text("#readout"));
  await shot("reset");
};
