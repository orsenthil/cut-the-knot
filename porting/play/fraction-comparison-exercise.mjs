// Compare fractions: answer wrongly, answer rightly, the graphics and the common denominator.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fraction-comparison-exercise
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const fr = () => page.evaluate(() => [...document.querySelectorAll("#row .frac")].map((f) => f.getAttribute("aria-label")).join(" | "));
  const rel = async () => { const m = (await fr()).match(/(\d+) over (\d+).*?(\d+) over (\d+)/); const [n1, d1, n2, d2] = m.slice(1).map(Number); return n1 * d2 === n2 * d1 ? 1 : n1 * d2 > n2 * d1 ? 2 : 0; };
  log("initial:", await fr(), "|", await text("#score"));
  await shot("initial");
  await page.check("#gBox"); await page.check("#cBox");
  log("graphics and common denominator:", await page.locator("#bars svg").count(), "bars");
  await shot("max-options");
  const r = await rel();
  await page.click(`#sign${(r + 1) % 3}`);
  log("a wrong answer:", await text("#status"), "| result =", await kind(), "|", await text("#score"));
  await shot("loss");
  await page.click("#nextBtn");
  await page.click(`#sign${await rel()}`);
  log("a right answer:", await text("#status"), "| result =", await kind(), "|", await text("#score"));
  await shot("win");
  if (!first) return;
  log("answer buttons off after answering:", await page.locator("#sign0").isDisabled());
  await page.uncheck("#gBox");
  log("graphics off: common box enabled =", await page.locator("#cBox").isEnabled());
  await page.click("#nextBtn");
  log("focus after New pair:", await page.evaluate(() => document.activeElement.id));
  await page.click("#restartBtn");
  log("after Reset scores:", await text("#score"));
  await shot("reset");
};
