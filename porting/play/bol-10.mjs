// BOL10: move the four handles to two different configurations and look at the claim.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-10
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: a long secant from a T moved up and to the right.
  await drag("Point T", 42, -38);
  await drag("Point C on", -38, 34);
  log("after moving T and C:", await text("#status"));
  await shot("long-secant");

  // Second configuration: reset, enlarge the circle, move its centre, and put
  // C on the far side so the chord BD crosses the picture.
  await page.click("#newBtn");
  await drag("Radius point", -12, 0);
  await drag("Centre O", 8, 4);
  await drag("Point C on", -14, -20);
  log("after resizing the circle:", await text("#status"));
  await shot("wide-circle");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and redraws the picture.
  await handle("Point C on").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() =>
    document.activeElement?.getAttribute("aria-label")?.split(".")[0] || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  await page.click("#checkBtn");
  log("after Check the claim:", await text("#status"));
  await shot("checked");

  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#statementBtn");
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  await page.click("#hintBtn");
  await page.click("#randomBtn");
  log("after Move C at random:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
