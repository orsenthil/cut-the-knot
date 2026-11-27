// Droz Farny: two configurations of the perpendicular lines and the triangle.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs droz-farny
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await handle(name).boundingBox();
    if (!box) throw new Error(`no handle for point ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 12 });
    await page.mouse.up();
  };

  const top = async () => { await page.evaluate(() => window.scrollTo(0, 0)); };

  await idle("#board .geom-handle");
  log("opening:", await text("#status"));
  await top(); await shot("opening");

  // First configuration: show the line of midpoints and the three circles
  // through H. The status line says the three cross marks are collinear.
  for (const id of ["lineBox", "xxBox", "yyBox", "zzBox", "abcBox", "namesBox"]) {
    await page.check(`#${id}`);
  }
  log("configuration 1:", await text("#status"));
  await top(); await shot("circles-and-line");

  // Second configuration: turn the two lines by dragging P, and move a
  // vertex. The marks stay on one line.
  await drag("P", 34, -22);
  await drag("A", -18, 16);
  log("configuration 2:", await text("#status"));
  await top(); await shot("turned-lines");

  if (!first) return; // the dark run only needs the two screenshots

  // Every option the applet's panel has, on then off again.
  const options = [
    "namesBox", "altBox", "premBox", "lineBox", "xxBox", "yyBox", "zzBox", "abcBox",
    "hrefABBox", "hrefBCBox", "hrefACBox", "xyzABBox", "xyzBCBox", "xyzACBox",
  ];
  for (const id of options) await page.check(`#${id}`);
  log("all options on:", await text("#status"));
  await top(); await shot("all-options");
  for (const id of options) await page.uncheck(`#${id}`);
  log("all options off:", await text("#status"));
  await top(); await shot("options-off");

  // Two arrow-key moves with focus left on the dragged handle.
  await handle("B").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));
  await top(); await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await top(); await shot("reset");
};
