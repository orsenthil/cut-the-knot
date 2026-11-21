// The Farey series: change N, pick fractions with the mouse and the arrow keys, the two checkboxes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs farey
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const click = async (q, p) => { // a click at the dot for p/q
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
    const b = await page.locator("#board").boundingBox();
    const n = Number(await page.inputValue("#nIn")), cell = (420 - 52) / n;
    await page.mouse.click(b.x + ((26 + q * cell) / 420) * b.width, b.y + ((420 - 26 - p * cell) / 420) * b.height);
  };
  log("initial:", await text("#info"));
  await shot("initial");
  await page.fill("#nIn", "70"); await page.press("#nIn", "Tab");
  log("N = 70:", (await text("#info")).slice(0, 60), "| more enabled =", await page.locator("#moreBtn").isEnabled());
  await shot("max-options");
  await page.fill("#nIn", "7"); await page.press("#nIn", "Tab");
  await click(2, 1);
  log("picked 1/2 at N = 7:", await text("#info"), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await page.focus("#board"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  log("two arrow keys, focus =", await focus(), "|", (await text("#info")).slice(0, 90));
  await page.keyboard.press("End"); log("End:", (await text("#info")).slice(0, 90));
  await page.keyboard.press("Escape"); log("Escape:", (await text("#info")).slice(0, 60));
  await page.uncheck("#halfBox"); log("one half off:", await text("#status"));
  await page.uncheck("#linesBox"); await page.check("#linesBox"); await page.check("#halfBox");
  await page.fill("#nIn", "1"); await page.press("#nIn", "Tab");
  log("N typed 1:", await text("#status"), "|", await page.inputValue("#nIn"));
  await page.fill("#nIn", "2"); await page.press("#nIn", "Tab");
  log("N = 2 less enabled =", await page.locator("#lessBtn").isEnabled());
  await page.click("#resetBtn");
  log("after Reset:", await page.inputValue("#nIn"), "| done =", await isDone());
  await shot("reset");
};
