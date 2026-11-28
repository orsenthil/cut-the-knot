// Heron's Formula: drag the corners into two different triangles, reveal the
// names and check that the two area calculations agree. There is no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs herons-formula
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: pull C right and up, show the labels and confirm
  // Heron's area, the incircle strip and the product diagram all agree.
  await drag("C", 105, -45);
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("first triangle:", await text("#status"));
  await shot("dissection");

  // Second configuration: reset, then pull B right into a much wider triangle.
  await page.click("#newBtn");
  await drag("B", 150, 10);
  log("wide triangle:", await text("#status"));
  await shot("wide-triangle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and redraws the dissection.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in player order and toggle the option both ways.
  await page.click("#namesBtn");
  log("names hidden:", await text("#status"));
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  log("after Check the formula:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));

  // An impossible, flat triangle must not break the page.
  const a = await corner("A").boundingBox();
  const c = await corner("C").boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 12 });
  await page.mouse.up();
  log("flat triangle:", await text("#status"));
  await page.click("#checkBtn");
  log("flat after check:", await text("#status"));
};
