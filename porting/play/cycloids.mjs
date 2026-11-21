// Cycloids: open the picture, add marks (the buttons and a press on the picture),
// roll a regular cycloid, then each of the circle kinds at the largest and the
// smallest ratio, push the spin to both ends, try bad numbers, and use the
// keyboard alone (focus must stay on the picture). "Reset" is the second scene.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cycloids
export default async ({ page, first, log, shot, text }) => {
  const isDone = () => page.evaluate(() => document.getElementById("status").classList.contains("done"));
  const val = (id) => page.locator("#" + id).textContent();
  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);
  const marks = () => page.evaluate(() => (window.Track && true) ? document.getElementById("status").textContent : "");
  const press = async (id, n) => { for (let i = 0; i < n; i++) if (await page.locator("#" + id).isEnabled()) await page.click("#" + id); };
  const rollFor = async (ms) => { await page.click("#startBtn"); await page.waitForTimeout(ms); await page.click("#startBtn"); };

  log("initial:", await text("#status"));
  await shot("initial");

  // Marks: rim, inside, outside, and a press on the picture.
  await page.click("#markRim"); await page.click("#markIn"); await page.click("#markOut");
  await page.evaluate(() => document.getElementById("board").scrollIntoView({ block: "center" })); // clear of the sticky header
  const box = await page.locator("#board").boundingBox();
  await page.mouse.click(box.x + box.width * 0.12, box.y + box.height * 0.8);
  log("four marks:", await text("#status"));

  // Roll on the line for a while: the disc stops by itself at the end of the line.
  await rollFor(1800);
  log("rolled on the line:", await text("#status"), "| done =", await isDone());
  await shot("explored");

  // Both ends of every control: the spin, the radius, the ratio.
  await press("speedMore", 12); log("spin at the top:", await val("speedOut"));
  await press("speedLess", 25); log("spin at the bottom:", await val("speedOut"));
  await page.fill("#radiusIn", "99"); await page.press("#radiusIn", "Tab"); log("radius typed 99:", await text("#status"), "|", await page.inputValue("#radiusIn"));
  await page.fill("#radiusIn", "60"); await page.press("#radiusIn", "Tab"); log("radius 60:", await page.inputValue("#radiusIn"));
  await shot("max-options");
  await page.fill("#radiusIn", "30"); await page.press("#radiusIn", "Tab");
  if (!first) return; // the dark run only needs the screenshots above

  // Inside a circle: the smallest ratio is 2 (a straight line), the largest 12.
  await page.check("input[value=hypo]");
  log("hypocycloid:", await text("#status"), "| ratio =", await val("ratioOut"), "| ratio less enabled =", await page.locator("#ratioLess").isEnabled());
  await press("speedMore", 0);
  await page.click("#markRim");
  await press("ratioMore", 2); // R/r = 4: the astroid
  await page.click("#markRim");
  await page.click("#stepBtn"); await page.click("#stepBtn"); await page.click("#stepBtn");
  for (let i = 0; i < 12; i++) await page.click("#stepBtn");
  log("astroid steps:", await val("ratioOut"));
  await shot("astroid");
  await press("ratioMore", 20); log("ratio at the top:", await val("ratioOut"), "| more enabled =", await page.locator("#ratioMore").isEnabled());
  await press("ratioLess", 20); log("ratio at the bottom:", await val("ratioOut"), "| less enabled =", await page.locator("#ratioLess").isEnabled());

  // Outside a circle: ratio 1 is the cardioid. Formula and curves only.
  await page.check("input[value=epi]");
  await page.click("#markRim");
  await press("ratioLess", 3); log("epicycloid ratio:", await val("ratioOut"));
  await page.check("#formulaBox"); await page.check("#curvesBox");
  await rollFor(1500);
  log("rolled outside, by formula, curves only:", await text("#status"));
  await shot("cardioid");

  // Keyboard alone: focus the picture, space to start and stop, the arrow to step.
  await page.focus("#board");
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  await page.keyboard.press(" "); await page.waitForTimeout(300); await page.keyboard.press(" ");
  log("after keyboard, focus =", await focus());
  await shot("keyboard");

  // Fill the marks to the limit, then Reset.
  for (let i = 0; i < 52; i++) if (await page.locator("#markIn").isEnabled()) await page.click("#markIn");
  log("marks at the limit:", await text("#status"), "| add enabled =", await page.locator("#markIn").isEnabled());
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"), "| done =", await isDone(), "| add enabled =", await page.locator("#markIn").isEnabled());
  await shot("reset");
};
