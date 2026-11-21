// City Block Hunt: set every option to its maximum, play honestly to a find
// using the page's two-corner opening, then explore to the dead end where only
// one square can hide the treasure. Every button and the keyboard are exercised.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs city-block-hunt
export default async ({ page, first, log, shot, text }) => {
  const clue = async (col, row) => (await text(`#cell-${col}-${row}`)).trim();
  const focus = () => page.evaluate(() => {
    const el = document.activeElement;
    return el ? (el.id || el.className || el.tagName) : "none";
  });
  const setN = async (value) => {
    await page.locator("#nInput").evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };

  log("initial:", await text("#status"), "| board", await text("#nInput"));
  await shot("initial");

  // Every option at its largest value: an 8 by 8 board with the hint on.
  await setN(8);
  await page.check("#hintCheck");
  log("maximum options:", await text("#status"), "| board", await text("#nInput"), "| hint", await page.isChecked("#hintCheck"));
  await shot("max-options");

  // Two adjacent corners determine the square. Read their clues, solve for
  // (col, row), then touch it. If a corner is the treasure we are done early.
  await page.click("#cell-0-0");
  let status = await text("#status");
  if (!status.includes("Found it")) {
    const d1 = Number(await clue(0, 0));
    await page.click("#cell-7-0");
    status = await text("#status");
    if (!status.includes("Found it")) {
      const d2 = Number(await clue(7, 0));
      const col = (d1 - d2 + 7) / 2;
      const row = d1 - col;
      log("corner clues:", d1, d2, "| deduce", `row ${row + 1}, column ${col + 1}`);
      await page.click(`#cell-${col}-${row}`);
      status = await text("#status");
    }
  }
  log("after a win:", status, "| class:", await page.locator("#status").getAttribute("class"));
  await shot("win");

  if (!first) return; // the dark run only needs the screenshots above

  // The smaller option extreme: a 2 by 2 board, then back to 4 by 4. A value
  // past the spinner's range is clamped exactly as the applet's model does.
  await setN(2);
  log("minimum board:", await text("#status"), "| board", await text("#nInput"));
  await shot("min-options");
  await setN(99);
  log("board above the range:", await text("#nInput"));
  await setN(0);
  log("board below the range:", await text("#nInput"));
  await setN(4);

  // The hint in both directions; the status says in words what it shows.
  await page.uncheck("#hintCheck");
  log("hint off:", await text("#status"));
  await page.check("#hintCheck");
  log("hint on:", await text("#status"));

  // Dead end: the two-corner opening leaves exactly one possible square, so
  // the hunt's uncertainty is over without the treasure being clicked. Retry
  // on the rare board where a corner itself holds the treasure.
  let dead = "";
  for (let attempt = 0; attempt < 6; attempt++) {
    await page.click("#newBtn");
    await page.click("#cell-0-0");
    if ((await text("#status")).includes("Found it")) continue;
    await page.click("#cell-3-0");
    dead = await text("#status");
    if (!dead.includes("Found it")) break;
  }
  log("after two corners:", dead, "| class:", await page.locator("#status").getAttribute("class"));
  if (!dead.includes("Only one square")) throw new Error("two corners did not determine the treasure: " + dead);
  await shot("dead-end");

  // Two keyboard moves on the grid; focus must stay on a board square.
  await page.focus("#cell-0-0");
  await page.keyboard.press("ArrowRight");
  const f1 = await focus();
  await page.keyboard.press("ArrowDown");
  const f2 = await focus();
  await page.keyboard.press("Enter");
  log("keyboard moves:", f1, f2, "| after Enter:", await text("#status"), "| focus:", await focus());
  await shot("keyboard");

  // Every button in the order a player would press them.
  await page.click("#newBtn");
  log("after New Game:", await text("#status"), "| board", await text("#nInput"));
  await shot("reset");
};
