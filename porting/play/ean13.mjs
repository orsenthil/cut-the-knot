// EAN-13: raise digits, type digits, and watch the check digit.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs ean13
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.className + " " + a.dataset.i); });
  const code = () => page.evaluate(() => [...document.querySelectorAll("#digits .digit")].map((e) => e.textContent).join(""));
  log("initial:", await code(), "|", await text("#sum"));
  await shot("initial");
  for (let i = 0; i < 12; i++) await page.locator("#digits button").nth(i).click();
  log("every digit raised once:", await code(), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await page.locator('#digits button[data-i="0"]').focus();
  for (const k of "9780142000") { await page.keyboard.press(k); await page.keyboard.press("ArrowRight"); }
  await page.keyboard.press("5"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("7");
  log("typed the page's ISBN example:", await code(), "| focus =", await focus());
  await shot("isbn");
  await page.click("#resetBtn");
  log("after Reset:", await code(), "| done =", await isDone());
  await shot("reset");
};
