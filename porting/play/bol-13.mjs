// BOL13: two chord configurations, with the hint and then the claim shown.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs bol-13
export default async ({ page, first, log, shot, idle, text }) => {
  const handle = (name) => page.locator(`#board [aria-label^="${name}"]`);
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

  // First configuration: swing C down and show the proof's auxiliary lines.
  await drag("Chord end C", 46, 42);
  await page.click("#hintBtn");
  log("after moving C and showing the hint:", await text("#status"));
  await shot("hint");

  // Second configuration: reset, swing D the other way, show the claim.
  await page.click("#newBtn");
  await drag("Chord end D", -64, 24);
  await page.click("#statementBtn");
  log("after moving D and showing the claim:", await text("#status"));
  await shot("claim");

  if (!first) return; // the dark run only needs the two screenshots

  // Two keyboard moves keep the focus on the board handle.
  await handle("Chord end D").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Every button in player order, both ways.
  await page.click("#statementBtn");
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#newBtn");
  log("after Reset:", await text("#status"));

  const pressed = await page.evaluate(() => [...document.querySelectorAll(".controls button[aria-pressed]")]
    .map((b) => `${b.id}:${b.getAttribute("aria-pressed")}`).join(" "));
  log("toggle states:", pressed);
};
