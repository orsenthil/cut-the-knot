// Two Numbers: mark a pick, do the two multiplications, get an announcement,
// then Try again for a fresh pair of numbers.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs two-numbers
export default async ({ page, first, log, shot, text }) => {
  await page.click("#numA");
  const a = Number(await text("#numA")), b = Number(await text("#numB"));
  const word = await text("#chosenWord");
  const cf = word === "odd" ? 3 : 2;      // multiplier for the number I picked
  const of = word === "odd" ? 2 : 3;      // multiplier for the other number
  const sum = a * cf + b * of;
  await page.fill("#sumIn", String(sum));
  await page.click("#guessBtn");
  log(`picked ${a}: ${a}x${cf} + ${b}x${of} = ${sum};`, "status:", await text("#status"));
  log("answer:", await text("#answer"));
  await shot("announcement");

  if (!first) return;
  await page.click("#newBtn");
  log("try again:", await text("#status"), "| answer cleared:", (await text("#answer")) === "");
  await shot("try-again");
  await page.fill("#sumIn", "12");
  await page.press("#sumIn", "Enter");
  log("by Enter:", await text("#status"));
};
