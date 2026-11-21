// Euclid's game with typed numbers: play to a win and to a loss, against the computer.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs euclid-alg
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const board = () => page.evaluate(() => [...document.querySelectorAll("#board .chip")].map((c) => Number(c.textContent)));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const put = async (n) => { await page.fill("#numIn", String(n)); await page.press("#numIn", "Enter"); };
  // play: type the smallest new multiple of g that is a difference, until over
  const play = async () => {
    for (let k = 0; k < 120; k++) {
      if (await kind()) return;
      await page.waitForFunction(() => !document.getElementById("numIn").disabled || ["win", "lose"].some((c) => document.getElementById("status").classList.contains(c)), null, { timeout: 4000 }).catch(() => {});
      if (await kind()) return;
      const b = await board(), g = gcd(b[b.length - 1], b[0]), max = b[b.length - 1];
      let pick = null;
      for (let n = max - g; n >= g && pick === null; n -= g) if (!b.includes(n) && b.some((x) => b.includes(x + n))) pick = n; // from the top: a different order from the computer's
      if (pick === null) return;
      await put(pick);
    }
  };
  const total = async () => Number((await text("#info")).match(/of (\d+)/)[1]);
  // you move first and win when the board ends with an odd number of numbers: keep pressing New game until it does
  const newGame = async (odd) => { for (let k = 0; k < 40; k++) { if (((await total()) % 2 === 1) === odd) return; await page.click("#newBtn"); } };
  await newGame(true);
  log("initial board:", await board(), "|", await text("#info"));
  await shot("initial");
  await put(1000); log("1000:", await text("#status"));
  await put(7); log("7 (not a difference or not a multiple):", await text("#status"));
  await shot("max-options");
  await play();
  log("after a whole game:", await text("#status"), "| result =", await kind(), "| board =", (await board()).length, "numbers");
  await shot("win");
  if (!first) return;
  await page.click("#newBtn"); await newGame(true); // an odd total again, but the computer moves first now: you lose
  await page.check("#startBox");
  log("Please start:", await text("#status"), "| board =", await board());
  await play();
  log("after the second game:", await text("#status"), "| result =", await kind());
  await shot("loss");
  await page.click("#newBtn");
  await page.focus("#numIn");
  log("new game, focus =", await focus(), "|", await text("#info"));
};
