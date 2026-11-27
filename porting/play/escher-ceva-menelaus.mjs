// Escher Ceva Menelaus: the opening concurrence, then a configuration where
// the three lines miss. Run with:
// NODE_PATH=$(npm root -g) node porting/play.mjs escher-ceva-menelaus
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

  await idle("#board .geom-handle");
  const start = await text("#status");
  log("opening Escher pattern:", start);
  if (!start.includes("meet at one point")) throw new Error("the opening picture is not concurrent");
  await shot("concurrent");

  // Configuration 2: move a side dot to another tick and push every spinner to
  // its maximum, as far from the 3-4-5 pattern as the applet allows.
  await drag("B1", -30, 3);
  await page.locator("#divAB").fill("30");
  await page.locator("#divBC").fill("30");
  await page.locator("#divCA").fill("30");
  const moved = await text("#status");
  log("after moving B1 and setting 30 parts per side:", moved);
  if (moved.includes("meet at one point")) throw new Error("the changed picture is still concurrent");
  await shot("miss");

  if (!first) return; // the dark run only needs the two screenshots above

  // Each option in both directions, including beyond the applet's 2..30 range.
  for (const id of ["#divAB", "#divBC", "#divCA"]) {
    await page.locator(id).fill("1");
    log(id, "minimum:", await page.locator(id).inputValue(), await text("#status"));
    await page.locator(id).fill("31");
    log(id, "maximum:", await page.locator(id).inputValue(), await text("#status"));
  }

  // Keyboard-only movement keeps focus on the dot after each redraw.
  await handle("C3").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || ""));
  log("after keyboard moves:", await text("#status"));

  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.keyboard.press("r");
  log("after the r shortcut:", await text("#status"));
};
