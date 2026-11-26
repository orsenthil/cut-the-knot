// Scoring: win one counter game by leaving multiples of Max Step + 1, lose
// another by giving the computer a winning position, then try options.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs scoring
export default async ({ page, first, log, shot, text }) => {
  const sq = (c) => `#board [data-square="${c}"]`;
  const counterAt = () => page.evaluate(() => [...document.querySelectorAll("#board .col")].findIndex((c) => c.querySelector(".chip") && c.dataset.square !== "0"));
  // Play perfectly: leave the counter on a multiple of 4.
  for (let round = 0; round < 6; round++) {
    const at = await counterAt();
    if (at <= 0) break;
    const to = at - (at % 4 || 1);
    await page.click(sq(at));
    await page.click(sq(Math.max(0, to)));
    await page.waitForTimeout(700);
    log(`moved ${at} -> ${to}:`, await text("#status"));
    if (await page.evaluate(() => document.getElementById("status").classList.length)) break;
  }
  log("after the first game:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));
  await shot("first-game");
  if (!first) return;

  // A new game where we hand over a winning position by moving one square.
  await page.click("#resetBtn");
  for (let round = 0; round < 8; round++) {
    const at = await counterAt();
    if (at <= 0) break;
    await page.click(sq(at));
    await page.click(sq(at - 1));
    await page.waitForTimeout(700);
    if (await page.evaluate(() => document.getElementById("status").classList.length)) break;
  }
  log("second game:", await text("#status"), "| class:", await page.getAttribute("#status", "class"));

  // Largest options, hints, keyboard.
  await page.selectOption("#countersInput", "5");
  await page.selectOption("#stepInput", "6");
  await page.selectOption("#lengthInput", "20");
  await page.selectOption("#hintInput", "3");
  log("big board:", await text("#status"), "|", await text("#scoreLine"));
  await shot("largest");
  await page.selectOption("#hintInput", "1");
  await page.selectOption("#stepInput", "2");
  await page.selectOption("#lengthInput", "5");
  const first0 = await page.evaluate(() => { const b = document.querySelector("#board .col:not(:disabled)"); b.focus(); return b.dataset.square; });
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  log("keyboard move from", first0, ":", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.square));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  log("second keyboard move:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.square));
  await shot("final");
};
