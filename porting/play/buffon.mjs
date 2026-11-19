// Buffon's Needle: every option at both ends, a keyboard-drawn noodle, a
// completed batch, and every button in the order a player would press them.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs buffon
export default async ({ page, first, log, shot, text, idle }) => {
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const done = () => document.getElementById("status").classList.contains("done");

  log("initial:", await text("#status"), "|", await text("#readout"));
  await shot("start");

  // Every option at its maximum. The Draw checkbox opens the noodle pad.
  await page.locator("#trials").fill("100");
  await page.locator("#skip").fill("1000");
  await page.check("#showPi");
  await page.check("#drawToggle");
  log("all options at maximum:", await text("#trialsVal"), "|", await text("#skipVal"), "|", await text("#status"));
  await shot("max-options");

  // Two keyboard moves on the pad, then two on the board: focus must stay put.
  await page.focus("#drawCanvas");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("after three keyboard points:", await text("#status"), "| focus:", await focus());
  await shot("noodle-drawn");

  // Save the shape, then bring the run down to a watchable size and play it.
  await page.click("#saveShapeBtn");
  log("after Save noodle:", await text("#status"));
  await shot("noodle-saved");
  await page.locator("#trials").fill("5");
  await page.locator("#skip").fill("0");

  await page.focus("#board");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Space");
  log("keyboard on the board:", await text("#status"), "|", await text("#readout"), "| focus:", await focus());

  await page.locator("#trials").fill("5");
  await page.click("#startBtn");
  await idle(done);
  log("after Start and a full batch:", await text("#status"), "|", await text("#readout"));
  await shot("completed");

  // The rest of the buttons, in player order.
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await page.click("#singleBtn");
  log("after Throw one:", await text("#status"));
  await page.click("#startBtn");
  await page.click("#startBtn");
  log("after Start then Stop:", await text("#status"));
  await page.click("#repeatBtn");
  await idle(done);
  log("after Repeat:", await text("#status"), "|", await text("#readout"));
  await shot("repeated");

  // Both extremes of every option: a Max below Min, a Min above Max.
  await page.locator("#trials").fill("0");
  log("at the low end of throws:", await text("#trialsVal"), "|", await text("#status"));
  await page.locator("#trials").fill("100");
  log("back at the high end:", await text("#trialsVal"), "|", await text("#status"));
  await page.locator("#skip").fill("0");
  await page.locator("#skip").fill("1000");
  log("skip at both ends:", await text("#skipVal"), "|", await text("#status"));
  await page.uncheck("#showPi");
  log("pi estimate hidden:", await text("#readout"));
  await page.check("#showPi");
  log("pi estimate shown:", await text("#readout"));

  await page.check("#drawToggle");
  await page.click("#clearShapeBtn");
  log("after Clear:", await text("#status"));
  await page.click("#saveShapeBtn");
  log("Save with too few points:", await text("#status"));
  await page.click("#cancelShapeBtn");
  log("after Cancel:", await text("#status"));
  await shot("final");

  if (!first) return; // the dark run only needs the screenshots above
};
