// Ceva PWW: two configurations of the proof-without-words picture.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ceva-pww
export default async ({ page, first, log, shot, idle, text }) => {
  const corner = (name) => page.locator(`#board [aria-label^="Corner ${name}"]`);
  const drag = async (name, dx, dy) => {
    const box = await corner(name).boundingBox();
    if (!box) throw new Error(`no handle for corner ${name}`);
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 10 });
    await page.mouse.up();
  };
  const counts = () => page.evaluate(() =>
    ["ae", "ec", "af", "fb"].map((k) => document.getElementById(k + "Input").value).join("/"));

  await idle("#board .geom-handle");
  log("start:", await text("#status"), "counts", await counts());

  // First configuration: a compact triangle with the grid and the dissection on.
  await drag("A", 38, -28);
  await drag("B", -46, 18);
  await page.click("#gridBtn");
  await page.click("#colorsBtn");
  log("configuration 1:", await text("#status"));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("grid-colors");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard movement keeps focus on the handle and updates the picture.
  await corner("C").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Second configuration: every count at its maximum, every option switched on.
  await page.click("#newBtn");
  for (const key of ["ae", "ec", "af", "fb"]) {
    for (let i = 0; i < 8; i++) await page.click(`#${key}More`);
  }
  for (const key of ["fineBtn", "diagonalsBtn", "gridBtn", "colorsBtn"]) {
    await page.click(`#${key}`);
  }
  log("cycle enabled by colors:", await page.evaluate(() => !document.getElementById("cycleBtn").disabled));
  await page.click("#cycleBtn");
  await drag("C", -55, -35);
  log("configuration 2:", await text("#status"), "counts", await counts());
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("max-options");

  // Press every button in order and move the counts both ways.
  await page.click("#cycleBtn");
  await page.click("#colorsBtn");
  await page.click("#diagonalsBtn");
  await page.click("#fineBtn");
  await page.click("#gridBtn");
  for (const key of ["ae", "ec", "af", "fb"]) {
    for (let i = 0; i < 12; i++) await page.click(`#${key}Less`);
  }
  log("at minimum counts:", await counts(), await text("#status"));
  await page.fill("#aeInput", "99");
  await page.locator("#aeInput").press("Tab");
  log("out-of-range entry clamped:", await counts());
  await page.click("#newBtn");
  log("after Reset:", await text("#status"), "counts", await counts());
};
