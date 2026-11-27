// Circle Of Similitude 1: look at two different configurations of the two
// circles, each with the statements that show the equalities, then exercise
// every control. It is an illustration, so there is no win or loss.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circle-of-similitude-1
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (label) => page.locator(`#board [aria-label^="${label}"]`);
  const drag = async (label, dx, dy) => {
    const box = await handle(label).boundingBox();
    if (!box) throw new Error(`no handle for ${label}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");

  // Configuration 1: the starting picture, with the right-angle statement and
  // the angle-bisection statement on.
  await page.click("#s1Btn");
  await page.click("#s2Btn");
  await page.click("#checkBtn");
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  // Configuration 2: make the second circle larger, slide T round the circle
  // of similitude and show the two length statements instead.
  await drag("Radius dot R2", 35, 0);
  await drag("Point T", 24, 22);
  await page.click("#s1Btn");
  await page.click("#s2Btn");
  await page.click("#s3Btn");
  await page.click("#s4Btn");
  await page.click("#hintBtn");
  await page.click("#checkBtn");
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two screenshots above

  // Keyboard movement: focus must survive on the dragged handle.
  await handle("Point T").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() =>
    document.activeElement && document.activeElement.getAttribute("aria-label"));
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in both directions, as a player would.
  for (const id of ["namesBtn", "hintBtn", "s1Btn", "s2Btn", "s3Btn", "s4Btn", "pairBtn"]) {
    await page.click(`#${id}`);
    await page.click(`#${id}`);
  }
  await page.click("#pairBtn");
  await page.click("#checkBtn");
  log("after the M pair:", await text("#status"));
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
};
