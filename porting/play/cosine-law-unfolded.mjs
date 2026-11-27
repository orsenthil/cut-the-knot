// Cosine Law Unfolded: two configurations of the draggable triangle, with
// every button pressed in both directions and a keyboard-only move checked.
// This is a demo, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cosine-law-unfolded
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 500) * box.width,
    y: box.y + (y / 520) * box.height,
  });
  const drag = async (from, to) => {
    const a = toClient(from[0], from[1]);
    const b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  const pressed = () => page.evaluate(() =>
    ["colorsBtn", "namesBtn", "hintBtn"]
      .map((id) => id + "=" + document.getElementById(id).getAttribute("aria-pressed"))
      .join(" "));

  log("initial:", await text("#status"), "|", await pressed());
  await shot("start");

  // Configuration 1: a tall triangle with C above AB.
  await drag([200, 233], [140, 210]);   // A
  await drag([340, 213], [380, 190]);   // B
  await drag([250, 193], [245, 60]);    // C
  for (const id of ["colorsBtn", "namesBtn", "hintBtn"]) await page.click("#" + id);
  log("config1:", await text("#status"), "|", await pressed());
  await shot("config1");

  // Keyboard-only move: the focused handle must stay focused after a redraw.
  await page.locator('#board circle[role="button"]').nth(2).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role"),
    label: document.activeElement?.getAttribute("aria-label")?.slice(0, 30),
  }));
  if (first) log("keyboard:", JSON.stringify(focus), "|", await text("#status"));

  // Configuration 2: reset, then a wide triangle with C below AB.
  await page.click("#resetBtn");
  await drag([200, 233], [120, 150]);   // A
  await drag([340, 213], [400, 140]);   // B
  await drag([250, 193], [260, 400]);   // C
  log("config2:", await text("#status"), "|", await pressed());
  await shot("config2");

  // Press every toggle the other way, and Reset once more.
  for (const id of ["colorsBtn", "namesBtn", "hintBtn"]) await page.click("#" + id);
  await page.click("#resetBtn");
  log("after toggles off and reset:", await text("#status"), "|", await pressed());
  await shot("reset");
};
