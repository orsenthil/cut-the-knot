// Very Tiles: fill all twelve gaps, check the matching patterns, then reset,
// swap two answers and check the mismatch; finish with a keyboard-only match.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs very-tiles

function answerOf(text) {
  for (let v = 1; v <= 12; v++) {
    const m = /^(\d+) \+ (\d+) = (\d+)$/.exec(text.replace("?", String(v)));
    if (m && Number(m[1]) + Number(m[2]) === Number(m[3])) return v;
  }
  throw new Error(`no answer in 1..12 for "${text}"`);
}

export default async ({ page, first, log, shot, text }) => {
  const readAnswers = async () =>
    (await page.locator("#problemsGrid .cell .label").allTextContents()).map((t) => answerOf(t.trim()));

  const place = async (numbers) => {
    for (let pos = 0; pos < numbers.length; pos++) {
      await page.click(`#tilesGrid .cell[data-pos="${numbers[pos] - 1}"]`);
      await page.click(`#problemsGrid .cell[data-pos="${pos}"]`);
    }
  };

  log("at the start:", await text("#status"));
  const right = await readAnswers();
  log("the twelve missing numbers:", right.join(" "));
  await place(right);
  log("all gaps filled:", await text("#status"), "| done:", await page.evaluate(() =>
    document.getElementById("status").classList.contains("done")));
  await page.click("#patternBtn");
  log("with the right matches:", await text("#status"));
  await shot("matched");
  if (!first) return; // the dark run only needs the matching screenshot

  await page.click("#newBtn");
  const again = await readAnswers();
  const swapped = again.slice();
  [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
  await place(swapped);
  await page.click("#patternBtn");
  log("after swapping two answers:", await text("#status"));
  await shot("mismatch");

  // Two keyboard moves: select an answer tile, go down to its problem, place it.
  await page.click("#newBtn");
  const numbers = await readAnswers();
  const tilePos = numbers[7] - 1; // the answer belonging to problem 7
  await page.locator(`#tilesGrid .cell[data-pos="${tilePos}"]`).focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  if (tilePos < 6) await page.keyboard.press("ArrowDown"); // cross from the top answer row
  await page.keyboard.press("Enter");
  log("by keyboard:", await text("#status"), "| focus:", await page.evaluate(() =>
    document.activeElement.parentElement.id + " " + document.activeElement.dataset.pos));
  await shot("keyboard");
};
