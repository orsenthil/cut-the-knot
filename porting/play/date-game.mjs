// The Date Game: follow the losing diagonal day - month = 19 to reach
// December 31 first (a win), then hand the computer a December date and let it
// finish (a loss). The starting day is random, so the play is adaptive.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs date-game

const DIAGONAL = 19;

export default async ({ page, first, log, shot, text }) => {
  const read = () =>
    page.evaluate(() => ({
      month: Number(document.getElementById("stage").dataset.month),
      day: Number(document.getElementById("stage").dataset.day),
      win: document.getElementById("status").classList.contains("win"),
      lose: document.getElementById("status").classList.contains("lose"),
    }));
  const clickMany = async (word, count) => {
    const selector = word === "month" ? "#monthBtn" : "#dayBtn";
    for (let i = 0; i < count; i++) await page.click(selector);
  };
  const waitReply = () =>
    page.waitForFunction(() => {
      const status = document.getElementById("status");
      return status.classList.contains("win") || status.classList.contains("lose") ||
        !status.textContent.includes("Thinking");
    }, null, { timeout: 10000 });

  // ---- a win: always step back onto the diagonal ----
  let turns = 0;
  let position = await read();
  log("start:", await text("#readOut"));
  while (!position.win && !position.lose && turns++ < 60) {
    let word;
    let target;
    if (position.day - position.month === DIAGONAL) {
      // A losing date: leave it, then let the computer make the same mistake.
      word = "month";
      target = position.month + 1;
    } else if (position.day - position.month < DIAGONAL) {
      word = "day";
      target = position.month + DIAGONAL;
    } else {
      word = "month";
      target = position.day - DIAGONAL;
    }
    await clickMany(word, target - (word === "month" ? position.month : position.day));
    await page.click("#moveBtn");
    await waitReply();
    position = await read();
  }
  log(`after ${turns} turns:`, await text("#status"));
  log("date:", await text("#readOut"));
  await shot("win");

  if (first) {
    // Every button in order: Reset, the word buttons and Move. The refusal
    // messages come from trying to advance a word past its last value.
    await page.click("#resetBtn");
    await clickMany("month", 11);
    log("after eleven month clicks:", await text("#readOut"));
    await page.click("#monthBtn"); // "Are there any more months?"
    log("past December:", await text("#status"));
    await shot("no-more-months");

    await page.click("#resetBtn");
    const resetPosition = await read();
    await clickMany("day", 30 - resetPosition.day);
    log("after day clicks:", await text("#readOut"));
    await page.click("#dayBtn"); // "How many days are in January?"
    log("past the last day:", await text("#status"));
    await shot("no-more-days");
  }

  // ---- a loss: leave the computer a December date with days to spare ----
  await page.click("#resetBtn");
  await clickMany("month", 11);
  log("handing the computer:", await text("#readOut"));
  await page.click("#moveBtn");
  await page.waitForFunction(() => /I won/.test(document.getElementById("status").textContent || ""), null, { timeout: 10000 });
  log("after the computer's win:", await text("#status"));
  log("date:", await text("#readOut"));
  await shot("loss");
};
