// In Ex Circum: two triangle configurations, plus the keyboard and every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs in-ex-circum
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

  // First configuration: a compact, slightly skewed triangle, showing the claim.
  await drag("A", 26, 16);
  await drag("C", -16, 12);
  await page.click("#claimBtn");
  await page.click("#checkBtn");
  log("after first configuration:", await text("#status"));
  await shot("first");

  // Second configuration: reset, then an obtuse triangle with every hint on.
  await page.click("#newBtn");
  await drag("B", -38, 24);
  await drag("C", 24, -8);
  await page.click("#namesBtn");
  await page.click("#hint1Btn");
  await page.click("#hint2Btn");
  await page.click("#checkBtn");
  log("after second configuration:", await text("#status"));
  await shot("second");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement keeps focus on the handle and redraws the diagram.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:", await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("status after keyboard:", await text("#status"));

  // Press every button, both directions, in the order a player would.
  await page.click("#checkBtn");
  await page.click("#hint2Btn");
  await page.click("#hint2Btn");
  await page.click("#hint1Btn");
  await page.click("#hint1Btn");
  await page.click("#claimBtn");
  await page.click("#claimBtn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
