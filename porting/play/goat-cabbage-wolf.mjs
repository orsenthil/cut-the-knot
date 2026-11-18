// Goat, Cabbage and Wolf: follow the seven-crossing hint route to a win, then
// take the cabbage first (leaving the wolf with the goat) for a loss. Also show
// the Hint text and press Reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs goat-cabbage-wolf

const ROUTE = [0, null, 1, 0, 2, null, 0]; // goat, alone, cabbage, goat, wolf, alone, goat

export default async ({ page, first, log, shot, text }) => {
  const ferry = async (item) => {
    if (item === null) await page.click("#crossBtn");
    else await page.click(`.item-btn[data-item="${item}"]:not(:disabled)`);
  };

  // ---- a win ----
  await page.check("#hintCheck");
  log("hint:", await text("#status"));
  await shot("hint");
  for (const item of ROUTE) await ferry(item);
  log("after seven crossings:", await text("#status"));
  log("crossings:", await text(".move-count"));
  await shot("win");

  if (first) {
    await page.uncheck("#hintCheck");
    await page.click("#resetBtn");
    log("after reset:", await text(".move-count"), "|", await text("#status"));
    // Keyboard: focus the goat button and ferry it with Enter.
    await page.focus('.item-btn[data-item="0"]');
    await page.keyboard.press("Enter");
    log("after a keyboard crossing:", await text(".move-count"));
    await shot("keyboard");
  }

  // ---- a loss: leave the wolf with the goat on the near shore ----
  await page.click("#resetBtn");
  await ferry(1); // the cabbage
  log("after taking the cabbage first:", await text("#status"));
  await shot("loss");
};
