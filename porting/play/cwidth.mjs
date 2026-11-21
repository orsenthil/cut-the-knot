// Shapes of Constant Width: open the picture, push the step to both ends, cycle
// every view by clicking, pause and turn it by hand with the arrow keys (the
// focus must stay on the picture), press Play and let it run a moment, and
// Reset. No win or loss: seeing all three views is its "done"; "Reset" is the
// second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cwidth
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const set = async (v) => { await page.fill("#stepIn", String(v)); await page.press("#stepIn", "Tab"); };

  await page.click("#pauseBtn"); // a steady picture for the screenshots (the page runs by itself otherwise)
  log("initial (paused):", await text("#viewBtn"), "|", await text("#status"));
  await shot("initial");

  // The step at its largest and smallest, and beyond.
  await set(30); log("step 30:", await page.inputValue("#stepIn"));
  await set(99); log("step typed 99:", await page.inputValue("#stepIn"));
  await set(0); log("step typed 0:", await page.inputValue("#stepIn"));
  await set(5);

  // Cycle every view with clicks on the picture.
  await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" })); // clear of the sticky header
  await page.click("#board");
  log("second view:", await text("#viewBtn"), "|", await text("#status"));
  await shot("max-options");
  await page.click("#board");
  log("third view:", await text("#viewBtn"), "| done =", await isDone());
  await page.focus("#board");
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowRight");
  log("after nine arrow presses:", await text("#status"), "| focus =", await focus());
  await shot("explored");
  if (!first) return; // the dark run only needs the screenshots above

  // The View button, then the first view again, turned by hand to angle 30 (an arc becomes the extreme).
  await page.click("#viewBtn");
  log("View button:", await text("#viewBtn"));
  await page.focus("#board");
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowRight");
  log("turned by hand:", await text("#status"));
  await shot("turned");

  // Play for a moment, then Pause and Reset.
  await page.click("#pauseBtn");
  await page.waitForTimeout(700);
  log("while playing:", await text("#pauseBtn"));
  await page.click("#pauseBtn");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| done =", await isDone());
  await shot("reset");
};
