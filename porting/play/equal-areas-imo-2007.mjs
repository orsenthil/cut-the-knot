// Equal Areas IMO2007: two triangles, with the equal shaded areas measured in
// the status line. Run with:
//   export NODE_PATH=$(npm root -g) && node porting/play.mjs equal-areas-imo-2007
export default async ({ page, first, log, shot, text }) => {
  const boardBox = async () => page.locator("#board").boundingBox();
  const drag = async (name, target) => {
    const box = await boardBox();
    const dot = await page.locator(`[aria-label^="Point ${name}."]`).boundingBox();
    if (!dot) throw new Error(`no handle for point ${name}`);
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + (target.x / 400) * box.width,
      box.y + (target.y / 300) * box.height,
      { steps: 10 },
    );
    await page.mouse.up();
  };
  const position = async (name) => page.evaluate((n) => {
    const el = document.querySelector(`[aria-label^="Point ${n}."]`);
    return el ? `${el.getAttribute("cx")}, ${el.getAttribute("cy")}` : "missing";
  }, name);

  log("on opening:", await text("#status"));
  await page.click("#detailsBox");
  log("with details:", await text("#status"));

  // Configuration 1: a broad triangle, names and construction lines on.
  await drag("A", { x: 215, y: 55 });
  await drag("B", { x: 55, y: 245 });
  await drag("C", { x: 345, y: 225 });
  log("broad triangle A:", await position("A"), "B:", await position("B"), "C:", await position("C"));
  log("broad triangle:", await text("#status"));
  if (!(await text("#status")).includes("They are equal")) {
    throw new Error("the two shaded areas should be equal in the broad triangle");
  }
  await shot("broad-triangle");
  if (!first) return; // the dark run has captured the same configuration

  // Configuration 2: a thin triangle, with the extra marks hidden again.
  await page.click("#namesBox");
  await page.click("#detailsBox");
  await drag("A", { x: 285, y: 32 });
  await drag("B", { x: 38, y: 275 });
  await drag("C", { x: 362, y: 190 });
  log("thin triangle:", await text("#status"));
  log("thin triangle A:", await position("A"), "B:", await position("B"), "C:", await position("C"));
  await shot("thin-triangle");

  // Keyboard movement must leave focus on the corner that was moved.
  await page.locator('[aria-label^="Point C."]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Point C.")) throw new Error("keyboard focus left point C");
  log("after keyboard moves:", await text("#status"));

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
