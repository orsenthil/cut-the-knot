// Two Circles and a Limit: log the opening picture, push every option to its
// largest value, then sweep the radius down towards the limit, try the option
// extremes, keyboard-only changes with a focus check, and every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs circles-and-limit
export default async ({ page, first, log, shot, idle, text }) => {
  const setR = async (value) => {
    await page.locator("#rInput").evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
  };

  log("initial:", await text("#status"), "| r =", await text("#rReadout"), "| E =", await text("#eReadout"));
  await shot("initial");

  // Every option at its largest: radius 6, names and hint on, proof 3.
  await setR("6");
  await page.check("#namesCheck");
  await page.check("#hintCheck");
  await page.selectOption("#proofSelect", "3");
  log("maximum options:", await text("#status"), "| r =", await text("#rReadout"), "| E =", await text("#eReadout"));
  await shot("max");

  if (!first) return; // the dark run only needs the two screenshots above

  // The smallest radius: E should be sitting almost exactly on 12.
  await setR("0.1");
  log("minimum radius:", await text("#status"), "| E =", await text("#eReadout"));
  const done = await page.evaluate(() => document.getElementById("status").classList.contains("done"));
  log("play marked done:", done);
  if (!done) throw new Error("exploring the demo did not mark the play done");
  await shot("min");

  // Two keyboard moves on the canvas alone; focus must stay on the picture.
  await page.focus("#plot");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => (document.activeElement && document.activeElement.id) || "");
  log("after two arrow keys: focus =", focused, "| r =", await text("#rReadout"), "|", await text("#status"));
  if (focused !== "plot") throw new Error("keyboard moves took focus off the canvas");
  await shot("keyboard");

  // Every toggle in both directions, and each proof, reported in words.
  await page.uncheck("#namesCheck");
  log("names off:", await text("#status"));
  await page.check("#namesCheck");
  log("names on:", await text("#status"));
  await page.uncheck("#hintCheck");
  log("hint off:", await text("#status"));
  await page.check("#hintCheck");
  log("hint on:", await text("#status"));
  for (const proof of ["1", "2", "3"]) {
    await page.selectOption("#proofSelect", proof);
    log("proof " + proof + ":", await text("#status"));
  }

  // Back to the start, including the radius, with no end-of-play class.
  await page.click("#newBtn");
  log("after Reset:", await text("#status"), "| r =", await text("#rReadout"), "| E =", await text("#eReadout"));
  await idle();
  await shot("reset");
};
