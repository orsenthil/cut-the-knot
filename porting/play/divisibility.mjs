// Divisibility: try the options, raise digits, and try to light all but one.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs divisibility
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.className + " " + a.dataset.i + "," + a.dataset.j); });
  log("initial:", await text("#summary"));
  await shot("initial");
  await page.fill("#colsIn", "8"); await page.fill("#rowsIn", "8"); await page.press("#rowsIn", "Tab");
  await page.fill("#pIn", "99"); await page.press("#pIn", "Tab");
  log("8 by 8, p = 99:", await text("#summary"));
  await shot("max-options");
  await page.fill("#colsIn", "2"); await page.fill("#rowsIn", "2"); await page.press("#rowsIn", "Tab");
  await page.fill("#pIn", "3"); await page.press("#pIn", "Tab");
  await page.locator("button.digit").first().click();
  log("pressed a digit:", await text("#summary"), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  // keyboard alone: type digits into the focused cell and move with the arrows
  await page.locator("button.digit").first().focus();
  await page.keyboard.press("4"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("2"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("0");
  log("typed 4, 2, 0: focus =", await focus(), "|", await text("#summary"));
  // p = 2 with a matrix that leaves exactly one odd number: [[0,1],[0,0]] has rows 01, 00 and columns 00, 10
  await page.fill("#pIn", "2"); await page.press("#pIn", "Tab");
  await page.locator('button.digit[data-i="0"][data-j="0"]').focus();
  await page.keyboard.press("0"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("1"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowDown"); await page.keyboard.press("0"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("0");
  log("p = 2, one odd number:", await text("#summary"));
  await shot("not-prime");
  await page.fill("#pIn", "1"); await page.press("#pIn", "Tab");
  log("p typed 1:", await text("#status"), "|", await page.inputValue("#pIn"));
  await page.fill("#colsIn", "9"); await page.press("#colsIn", "Tab");
  log("columns typed 9:", await text("#status"), "|", await page.inputValue("#colsIn"));
  await page.click("#newBtn");
  log("new digits:", await text("#status"), "| done =", await isDone());
  await shot("reset");
};
