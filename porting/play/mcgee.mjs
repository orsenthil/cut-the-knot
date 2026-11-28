// Ian McGee's observation: two configurations of the equal tangents.
// Run with: export NODE_PATH=$(npm root -g) && node porting/play.mjs mcgee
export default async ({ page, first, log, shot, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="Point ${name}"]`);
  const drag = async (name, target) => {
    const svg = page.locator("#board");
    const box = await svg.boundingBox();
    const dot = await handle(name).boundingBox();
    if (!dot || !box) throw new Error(`no handle for ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 400) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };
  // Points on the 400x400 board, radius min(400,400)/4.5.
  const at = (degrees) => ({
    x: 200 + (400 / 4.5) * Math.cos((degrees * Math.PI) / 180),
    y: 200 + (400 / 4.5) * Math.sin((degrees * Math.PI) / 180),
  });

  log("on opening:", await text("#status"));
  await page.click("#statementBox");
  await page.click("#premiseBox");
  await page.click("#hintBox");
  log("with all clues:", await text("#status"));

  // Configuration 1: A at 0 degrees, B at 126 degrees, long tangents.
  await drag("A", at(0));
  await drag("B", at(126));
  await page.locator("#lengthRange").focus();
  await page.keyboard.press("End"); // the scrollbar's maximum, 200
  log("A at 0°, B at 126°, length 200:", await text("#status"));
  await shot("long");

  // Configuration 2: reset, then both points below the middle and length -200.
  await page.click("#resetBtn");
  await drag("A", at(-68));
  await drag("B", at(52));
  await page.locator("#lengthRange").focus();
  await page.keyboard.press("Home"); // the scrollbar's minimum, -200
  await page.click("#statementBox");
  log("A at -68°, B at 52°, length -200:", await text("#status"));
  await shot("reverse");

  if (!first) return; // the dark run has taken both screenshots already

  // Arrow keys move a handle without losing keyboard focus.
  const a = handle("A");
  await a.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after arrow keys:", focused);
  if (!focused.startsWith("Point A")) throw new Error("keyboard focus left point A");
  log("status after keyboard:", await text("#status"));

  // Press every control in both directions, as a player would.
  for (const id of ["#namesBox", "#statementBox", "#premiseBox", "#hintBox"]) {
    await page.click(id);
    await page.click(id);
  }
  await page.locator("#lengthRange").focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Home");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
