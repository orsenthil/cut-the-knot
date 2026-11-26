// UPC: change digits by clicking their halves and by typing, then watch the check digit.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs upc
export default async ({ page, first, log, shot, text }) => {
  const code = () => page.evaluate(() => [...document.querySelectorAll("#digits .digit")].map((e) => e.textContent).join(""));
  const done = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => { const a = document.activeElement; return (a && a.dataset.i) || a.tagName; });

  log("initial:", await code(), "|", await text("#sum"));
  await shot("initial");

  // The applet raises a digit on a click in its left half and lowers it in the right half.
  await page.locator('#digits button[data-i="0"]').click({ position: { x: 5, y: 10 } });
  const box = await page.locator('#digits button[data-i="7"]').boundingBox();
  await page.locator('#digits button[data-i="7"]').click({ position: { x: Math.round(box.width) - 5, y: 10 } });
  log("after raising digit 1 and lowering digit 8:", await code(), "| done =", await done(), "|", await text("#status"));
  await shot("clicked");
  if (!first) return;

  await page.locator('#digits button[data-i="2"]').focus();
  await page.keyboard.press("7");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  log("after typing and arrow keys:", await code(), "| focus digit =", await focus(), "|", await text("#status"));
  await shot("keyboard");

  await page.click("#resetBtn");
  log("after Reset:", await code(), "| done =", await done(), "|", await text("#sum"));
  await shot("reset");
};
