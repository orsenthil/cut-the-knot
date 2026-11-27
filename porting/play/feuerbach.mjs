// Feuerbach demo: two triangle configurations, with the touching circles and
// then with every guide shown. No win or loss exists in this applet.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs feuerbach

export default async ({ page, first, log, shot, text }) => {
  const drag = async (label, fx, fy) => {
    const board = await page.locator("#board").boundingBox();
    const handle = await page.locator(`[aria-label^="${label}"]`).boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(board.x + board.width * fx, board.y + board.height * fy, { steps: 12 });
    await page.mouse.up();
  };

  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: a scalene triangle with the four touching circles.
  await page.click("#circlesCheck");
  await drag("Corner A", 0.55, 0.12);
  log("scalene with circles:", await text("#status"));
  await shot("circles");

  if (!first) return; // dark mode only needs the first configuration

  // Configuration 2: every applet guide on and a second triangle shape.
  await page.click("#mediansCheck");
  await page.click("#altitudesCheck");
  await page.click("#namesCheck");
  await drag("Corner C", 0.78, 0.78);
  log("all guides:", await text("#status"));
  await shot("guides");

  // Keyboard play, then every checkbox in both directions and a reset.
  await page.locator('[aria-label^="Corner B"]').focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowDown");
  log("focus after two arrow keys:",
    await page.evaluate(() => document.activeElement?.getAttribute("aria-label")));
  log("after keyboard:", await text("#status"));
  await shot("keyboard");

  for (const id of ["#circlesCheck", "#mediansCheck", "#altitudesCheck", "#namesCheck"]) await page.click(id);
  log("everything off:", await text("#status"));
  await shot("minimal");
  for (const id of ["#circlesCheck", "#mediansCheck", "#altitudesCheck", "#namesCheck"]) await page.click(id);
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("final");
};
