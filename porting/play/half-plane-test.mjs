// Two configurations of the half-plane intersection: one line, and the maximum
// twenty lines with the highlighted line slid by a pointer drag.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs half-plane-test
export default async ({ page, first, log, shot, text }) => {
  const client = async (x, y) => {
    const b = await page.locator("#board").boundingBox();
    return { x: b.x + (x / 400) * b.width, y: b.y + (y / 300) * b.height };
  };

  // Configuration 1: the applet's starting count, one line and its shaded side.
  await page.check("#showBox");
  log("one line:", await text("#status"));
  await shot("one-line");

  // Configuration 2: the spin's largest value, twenty lines.
  await page.fill("#countIn", "20");
  await page.press("#countIn", "Tab");
  log("twenty lines:", await text("#status"));

  const ends = await page.evaluate(() => {
    const line = document.querySelector("#board line.half-line.selected");
    return {
      x1: Number(line.getAttribute("x1")), y1: Number(line.getAttribute("y1")),
      x2: Number(line.getAttribute("x2")), y2: Number(line.getAttribute("y2")),
    };
  });
  const mid = { x: (ends.x1 + ends.x2) / 2, y: (ends.y1 + ends.y2) / 2 };
  const dx = ends.x2 - ends.x1, dy = ends.y2 - ends.y1;
  const len = Math.hypot(dx, dy) || 1;
  // Slide square across the line, so the shaded overlap visibly changes.
  const from = await client(mid.x, mid.y);
  const to = await client(mid.x - (dy / len) * 70, mid.y + (dx / len) * 70);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2);
  await page.mouse.move(to.x, to.y);
  await page.mouse.up();
  log("after sliding the middle:", await text("#status"));
  await shot("twenty-lines");

  if (!first) return; // the dark run only needs the two screenshots above

  // The arrow keys keep focus on the board after a move.
  const handle = page.locator('#board circle[role="button"]').first();
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  log("after ArrowRight:", await text("#status"));
  log("focus after move:", await page.evaluate(() => document.activeElement?.getAttribute("role")));
  await page.click("#modeBtn");
  await handle.focus();
  await page.keyboard.press("ArrowUp");
  log("after sliding with arrows:", await text("#status"), "|", await page.textContent("#modeBtn"));

  // Press every control in the order a visitor would.
  await page.click("#nextBtn");
  await page.click("#prevBtn");
  await page.uncheck("#showBox");
  await page.check("#showBox");
  await page.fill("#countIn", "0");
  await page.press("#countIn", "Tab");
  log("count clamped to one:", await page.inputValue("#countIn"));
  await page.fill("#countIn", "99");
  await page.press("#countIn", "Tab");
  log("count clamped to twenty:", await page.inputValue("#countIn"));
  await page.click("#newBtn");
  log("after New lines:", await text("#status"));
  log("done:", await page.evaluate(() => document.getElementById("status").classList.contains("done")));
  await shot("explored");
};
