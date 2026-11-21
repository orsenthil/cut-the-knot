// Fraction comparison sped up: a wrong check, then a right one, then the other buttons.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fc-exercise
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.id || a.className + " " + a.dataset.which + a.dataset.place); });
  const fractions = () => page.evaluate(() => [...document.querySelectorAll("#row .frac")].map((f) => f.getAttribute("aria-label") || [...f.querySelectorAll("button")].map((b) => b.textContent).join("")));
  const mid = () => page.evaluate(() => { const g = [...document.querySelectorAll("#row .mid .digits")].map((d) => Number([...d.querySelectorAll("button")].map((b) => b.textContent).join(""))); return g; });
  const set = async (which, str) => { await page.locator(`button.digit[data-which="${which}"][data-place="1"]`).focus(); for (const k of str) { await page.keyboard.press(k); if (k !== str[str.length - 1]) await page.keyboard.press("ArrowRight"); } };
  const pair = async () => { const f = await fractions(); const m = f.map((x) => x.match(/(\d+) over (\d+)/)).filter(Boolean).map((x) => [Number(x[1]), Number(x[2])]); return m; };
  log("initial:", await fractions(), "|", await text("#score"));
  await shot("initial");
  await page.click("#commonBtn"); log("common denominator:", await fractions());
  await page.click("#simplifyBtn"); log("simplify:", await fractions());
  await shot("max-options");
  await page.click("#checkBtn");
  log("the first guess is outside the pair:", await text("#status"), "| result =", await kind());
  await shot("loss");
  await page.click("#nextBtn");
  // find a fraction between the two on the page: the average of the two as an exact fraction, written as two digits each
  const [[n1, d1], [n2, d2]] = await pair();
  let found = null;
  for (let d = 1; d < 100 && !found; d++) for (let n = 0; n < 100 && !found; n++) { if (n * d1 > n1 * d && n * d2 > n2 * d !== (n1 * d2 > n2 * d1)) { /* strictly between */ } const a = n * d1 - n1 * d, b = n * d2 - n2 * d; if ((a > 0 && b < 0) || (a < 0 && b > 0)) found = [n, d]; }
  await set("n0", String(found[0]).padStart(2, "0")); await set("d0", String(found[1]).padStart(2, "0"));
  log("typed a fraction in between:", found, "->", await mid());
  await page.click("#checkBtn");
  log("after Check:", await text("#status"), "| result =", await kind(), "|", await text("#score"));
  await shot("win");
  if (!first) return;
  log("buttons disabled after Check:", await page.locator("#checkBtn").isDisabled(), await page.locator("#commonBtn").isDisabled());
  await page.click("#nextBtn");
  log("focus after New pair:", await focus());
  await page.locator('button.digit[data-which="d0"][data-place="1"]').focus();
  await page.keyboard.press("0"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("0");
  await page.click("#checkBtn");
  log("denominator 0:", await text("#status"), "| result =", await kind());
  await page.click("#restartBtn");
  log("after Reset scores:", await text("#score"), "| status:", await text("#status"));
  await shot("reset");
};
