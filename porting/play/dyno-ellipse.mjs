// Dyno Ellipse is a demo, so two configurations stand in for a win and a loss:
// counter-rotating arms draw an ellipse, then a 2:1 speed ratio with a 1:2
// length ratio draws a cardioid. The pen is dragged and arrowed along the curve,
// both Show boxes are toggled, and every slider is pushed to both extremes.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs dyno-ellipse
export default async ({ page, first, log, shot, text }) => {
  const setRange = (id, value) => page.locator("#" + id).evaluate((el, v) => {
    el.value = String(v);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
  const statusClass = () => page.evaluate(() => document.getElementById("status").className);
  const focused = () => page.evaluate(() => document.activeElement && document.activeElement.getAttribute("aria-label"));
  const runFor = async (ms) => { await page.click("#goBtn"); await page.waitForTimeout(ms); await page.click("#goBtn"); };

  log("start:", await text("#status"));
  await shot("start");

  // Configuration 1: W = -1, the counter-rotating vectors of the page's claim.
  await setRange("rate1", 2);
  await setRange("rate2", -2);
  await setRange("r1", 60);
  await setRange("r2", 40);
  log("configuration 1 set:", await text("#status"));
  await runFor(6500); // a full ellipse needs 720*pi/2 steps at three steps a frame
  log("configuration 1, pen traced:", await text("#status"), "|", await statusClass());
  await shot("configuration-1");

  // Two keyboard steps must move through time and leave focus on the pen.
  const pen = page.locator('[aria-label^="Tracing pen"]');
  await pen.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  log("after two arrow keys, focus:", await focused());
  log("after keyboard:", await text("#status"));

  // Configuration 2: W = 2 and R = 1/2, the cardioid named on the page.
  await setRange("rate1", 2);
  await setRange("rate2", 1);
  await setRange("r1", 20);
  await setRange("r2", 40);
  await runFor(8000); // most of one cardioid
  log("configuration 2, pen traced:", await text("#status"));
  await shot("configuration-2");

  if (!first) return; // the dark run only needs the two configuration screenshots

  // Drag the pen onto another moment of the curve.
  await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" }));
  const board = await page.locator("#board").boundingBox();
  const handle = await pen.boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(board.x + board.width * 0.62, board.y + board.height * 0.42, { steps: 8 });
  await page.mouse.up();
  log("after drag:", await text("#status"));

  // Both Show boxes, in both directions.
  await page.uncheck("#circlesBox");
  await page.uncheck("#barsBox");
  log("both shows off:", await text("#status"));
  await shot("bare-curve");
  await page.check("#circlesBox");
  await page.check("#barsBox");
  log("both shows on:", await text("#status"));

  // Every option to its largest and then its smallest value.
  for (const id of ["rate1", "rate2", "r1", "r2"]) await setRange(id, id.startsWith("rate") ? 50 : 100);
  log("all options at maximum:", await text("#status"));
  await shot("max-options");
  for (const id of ["rate1", "rate2", "r1", "r2"]) await setRange(id, id.startsWith("rate") ? -50 : 0);
  log("all options at minimum:", await text("#status"));
  await runFor(500);
  await shot("min-options");

  // Home, End and Reset: the last button leaves the four numbers as the applet had them.
  await pen.focus();
  await page.keyboard.press("Home");
  await page.keyboard.press("End");
  log("after Home then End:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "|", await statusClass());
  await shot("reset");
};
