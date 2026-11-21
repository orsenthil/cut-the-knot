// Distance from a point to a line: explore it by dragging; Reset is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs distance-to-line
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const drag = async (fx, fy, tx, ty) => {
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
    const b = await page.locator("#board").boundingBox();
    const pt = (x, y) => [b.x + ((20 + ((x + 6) / 12) * 380) / 420) * b.width, b.y + ((420 - 20 - ((y + 6) / 12) * 380) / 420) * b.height];
    const [a1, a2] = pt(fx, fy), [c1, c2] = pt(tx, ty);
    await page.mouse.move(a1, a2); await page.mouse.down(); await page.mouse.move((a1 + c1) / 2, (a2 + c2) / 2); await page.mouse.move(c1, c2); await page.mouse.up();
  };
  log("initial:", await text("#distance"));
  await shot("initial");
  await page.check("#normBox"); await page.check("#levelBox"); await page.fill("#digitsIn", "6"); await page.press("#digitsIn", "Tab");
  log("normalized, 6 digits:", await text("#equation"), "|", await text("#distance"));
  await shot("max-options");
  await drag(-1, 3, 2, 0);
  log("after dragging P:", await text("#distance"), "| done =", await isDone());
  await shot("explored");
  if (!first) return;
  await page.fill("#px", "0"); await page.fill("#py", "0"); await page.press("#py", "Tab");
  log("P typed at the origin:", await text("#distance"));
  await page.fill("#p2x", "-4"); await page.fill("#p2y", "-2"); await page.press("#p2y", "Tab");
  log("same two points:", await text("#status"));
  await page.fill("#digitsIn", "9"); await page.press("#digitsIn", "Tab");
  log("digits typed 9:", await text("#status"), "|", await page.inputValue("#digitsIn"));
  await page.focus("#p1x"); await page.keyboard.press("ArrowUp");
  log("keyboard step, focus =", await page.evaluate(() => document.activeElement.id));
  await page.click("#resetBtn");
  log("after Reset:", await text("#equation"), "| done =", await isDone());
  await shot("reset");
};
