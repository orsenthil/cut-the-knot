// BQTN: explore two configurations of the touching-circle chain, in both themes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bqtn
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const setNumber = async (id, value) => {
    await page.fill(`#${id}`, String(value));
    await page.locator(`#${id}`).dispatchEvent("change");
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: an irregular triangle, with the closing claim checked.
  await drag("Corner 2.", -26, 34);
  await drag("Point P,", 0, 8);
  await page.click("#checkBtn");
  log("odd triangle:", await text("#status"));
  await shot("triangle");

  // Second configuration: seven sides, a marked pair and a dragged corner.
  await setNumber("nInput", 7);
  await setNumber("whichInput", 3);
  await drag("Corner 4.", 18, -12);
  await page.click("#checkBtn");
  log("seven sides:", await text("#status"));
  await shot("heptagon");

  if (!first) return; // the dark run only needs the two screenshots

  // Arrow keys keep the focus on the board while the picture follows.
  await handle("Corner 1.").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Exercise every option in both directions, including a pair beyond the old max.
  await setNumber("nInput", 3);
  await setNumber("whichInput", 0);
  await setNumber("whichInput", 6);
  await setNumber("nInput", 21);
  await setNumber("whichInput", 42);
  await setNumber("nInput", 5);
  log("five sides after the extremes:", await text("#status"));

  await page.click("#checkBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));
  await shot("reset");
};
