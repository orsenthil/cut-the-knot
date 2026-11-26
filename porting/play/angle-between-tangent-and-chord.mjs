// Angle Between Tangent And Chord: drag the circle and C to two configurations.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs angle-between-tangent-and-chord
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
  const drag = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const dot = await handle(name).boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 360) * box.width,
      box.y + (target.y / 240) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };

  log("on opening:", await text("#status"));
  await page.click("#hintBox");
  await page.click("#statementBox");
  log("with overlays:", await text("#status"));

  // Configuration 1: large circle, C pulled far up and right.
  await drag("Radius point R", { x: 35, y: 135 });
  await drag("Outside point C", { x: 340, y: 40 });
  log("large circle, C far away:", await text("#status"));
  await shot("far");

  // Configuration 2: smaller circle moved right, C brought close to it.
  await page.click("#resetBtn");
  await drag("Circle centre O", { x: 150, y: 150 });
  await drag("Radius point R", { x: 200, y: 150 });
  await drag("Outside point C", { x: 230, y: 60 });
  log("small circle, C close:", await text("#status"));
  await shot("close");

  if (!first) return; // the dark run has taken both screenshots already

  // Arrow keys move a handle without losing keyboard focus.
  const c = handle("Outside point C");
  await c.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  if (!focused.startsWith("Outside point C")) throw new Error("keyboard focus left point C");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#statementBox", "#hintBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
