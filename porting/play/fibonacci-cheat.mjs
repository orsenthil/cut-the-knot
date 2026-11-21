// A faulty dissection: drag the four pieces over, then switch on the honest pieces; animate and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fibonacci-cheat
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const placed = () => page.locator('#pieceBtns button[aria-pressed="true"]').count();
  const focus = () => page.evaluate(() => { const a = document.activeElement; return a && (a.tagName + " " + (a.textContent || "").slice(0, 20)); });
  const drag = async (fx, fy, tx, ty) => { // world cells
    await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
    const b = await page.locator("#board").boundingBox();
    const S = Math.min(560 / 14, 560 / 13), ox = (560 - S * 14) / 2, oy = (560 - S * 13) / 2;
    const pt = (x, y) => [b.x + ((ox + x * S) / 560) * b.width, b.y + ((oy + y * S) / 560) * b.height];
    const [a1, a2] = pt(fx, fy), [c1, c2] = pt(tx, ty);
    await page.mouse.move(a1, a2); await page.mouse.down(); await page.mouse.move((a1 + c1) / 2, (a2 + c2) / 2, { steps: 4 }); await page.mouse.move(c1, c2, { steps: 4 }); await page.mouse.up();
  };
  log("initial:", await text("#status"), "| placed =", await placed());
  await shot("initial");
  // grab each piece at the middle of its corners and drop it a little short of the middle of its place
  await drag(5.333, 3.5, 12.9, 5.4);     // triangle 1
  log("triangle 1 dragged:", await text("#status"), "| placed =", await placed());
  await drag(2.667, 4.5, 10.0, 7.7);     // triangle 2
  await drag(2, 8, 11.0, 2.5);           // trapezoid 3
  await drag(6, 8, 12.0, 10.4);          // trapezoid 4
  log("all four dragged:", await text("#status"), "| placed =", await placed(), "| done =", await isDone());
  await shot("explored");
  await page.check("#honestBox");
  log("honest pieces:", await text("#status"));
  await shot("max-options");
  if (!first) return;
  await page.uncheck("#honestBox");
  await page.click("#resetBtn"); log("after Reset:", await placed(), "| done =", await isDone());
  await page.click("#animBtn"); await page.waitForTimeout(2200);
  log("after Animate:", await text("#status"), "| placed =", await placed());
  await page.click("#animBtn"); await page.waitForTimeout(2200);
  log("Animate again goes back:", await placed());
  await page.locator('#pieceBtns button[data-id="2"]').focus(); await page.keyboard.press("Enter");
  log("keyboard: piece 3 placed =", await placed(), "| focus =", await focus());
  await page.keyboard.press("Enter");
  log("keyboard: piece 3 taken back =", await placed());
  await shot("reset");
};
