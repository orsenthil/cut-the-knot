// Mini Lights Out: force a known board, solve via hint presses, then a fresh scramble.
export default async ({ page, first, log, shot, text }) => {
  // Seed a non-trivial board and expose presses through the hint overlay.
  await page.evaluate(() => {
    // Rebuild with a fixed pattern: only (0,0) lit.
    const H = Merlin4x4Core;
    const board = H.empty();
    board[0][0] = 1;
    // Reach into the page closure by driving Reset then overwriting via clicks
    // is hard; instead set Math.random then Reset, then click solution from hint.
    const real = Math.random;
    let i = 0;
    // Deterministic: first 16 calls yield [1,0,0,...] then zeros — actually
    // randomBoard uses floor(rand()*2). Force all zeros then press (0,0) once.
    Math.random = () => 0; // all-off board
    document.getElementById("resetBtn").click();
    Math.random = real;
  });

  // All-off is already solved — press (0,0) to light the plus, then solve.
  const cells = () => page.$$("#board .cell");
  let btns = await cells();
  await btns[0].click(); // lights (0,0) and neighbours
  log("after press:", await text("#status"));

  await page.check("#hintInput");
  await page.waitForFunction(
    () => document.querySelectorAll("#board .cell.press").length > 0,
  );
  const toPress = await page.$$eval("#board .cell", (els) =>
    els.map((el, i) => (el.classList.contains("press") ? i : -1)).filter((i) => i >= 0),
  );
  await page.uncheck("#hintInput");

  for (const i of toPress) {
    btns = await cells();
    await btns[i].click();
  }
  log("win:", await text("#status"));
  await shot("win");

  if (!first) return;

  await page.evaluate(() => {
    const real = Math.random;
    let n = 0;
    Math.random = () => {
      // Alternate bits so the board is not trivial.
      n++;
      return n % 3 === 0 ? 0.9 : 0.1;
    };
    document.getElementById("resetBtn").click();
    Math.random = real;
  });
  log("scramble lit:", await page.$$eval("#board .cell.on", (els) => els.length));
  await shot("scramble");
};
