// Carpets In Parallelogram: two configurations of the illustration, with
// screenshots. There is no win or loss: this is an interactive proof.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs carpets-in-parallelogram
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator("#board [aria-label^='" +
    (["A", "B", "C", "D"].includes(name) ? "Corner " + name : "Point " + name + " ") + "']");
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  await idle("#board .geom-handle");
  log("start:", await text("#status"));

  // First configuration: slide P and R along their sides, then show the
  // pink triangles and the orange triangle used in the proof.
  await drag("P", -45, 35);
  await drag("R", 35, -45);
  await page.click("#hint");
  await page.click("#names");
  log("hint and names on:", await text("#status"));
  await shot("hint-and-points");

  // Second configuration: reset the picture, slide the bottom corners and
  // move Q towards D. The checkboxes stay ticked, as in the applet's panel.
  await page.click("#resetBtn");
  await drag("A", 55, 0);
  await drag("B", 35, 0);
  await drag("Q", -25, 0);
  log("slanted box moved:", await text("#status"));
  await shot("moved-corners");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard-only moves: focus must stay on the moved point.
  await handle("P").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every control in the order a player would, in both directions.
  await page.click("#names");
  log("names off:", await text("#status"));
  await page.click("#names");
  await page.click("#hint");
  log("hint off:", await text("#status"));
  await page.click("#hint");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
