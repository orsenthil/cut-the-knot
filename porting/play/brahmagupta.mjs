// Brahmagupta: two draggable configurations of the cyclic quadrilateral.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs brahmagupta
export default async ({ page, first, log, shot, text }) => {
  const drag = async (from, to) => {
    const box = await page.locator("#board").boundingBox();
    const client = (p) => ({
      x: box.x + (p[0] / 500) * box.width,
      y: box.y + (p[1] / 400) * box.height,
    });
    const a = client(from), b = client(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
  };
  const settle = async (name) => {
    await shot(name);
    log(name + ":", await text("#readout"), "|", await text("#status"));
  };

  log("initial:", await text("#readout"), "|", await text("#status"));
  await shot("start");

  // First configuration: D slides down the circle to angle 0.5.
  await drag([381, 226], [367, 264]);
  await settle("config1");

  // Second configuration: A and D both move to the upper half of the circle.
  await drag([195, 79], [298, 76]);
  await drag([367, 264], [172, 92]);
  await settle("config2");

  if (!first) return;

  await page.locator("#board circle.handle-a").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("keyboard:", await text("#readout"),
    "| focus =", await page.evaluate(() => document.activeElement.getAttribute("aria-label")?.slice(0, 10)));
  await shot("keyboard");

  await page.click("#newBtn");
  await settle("reset");
};
