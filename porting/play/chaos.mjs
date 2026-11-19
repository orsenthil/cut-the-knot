// Emergence of Chaos: explore the parameter, then press every button.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs chaos
export default async ({ page, first, log, shot, idle, text }) => {
  const setSlider = async (value) => {
    await page.locator("#lambda").evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };

  // What the page opens with: a = 0.7, one resting spot, web not yet moving.
  log("initial status:", await text("#status"));
  log("initial a:", await text("#lambdaVal"));
  await shot("initial");

  // The only option, at its maximum: a = 1, chaotic, dots all over.
  await setSlider("1");
  log("maximum option:", await text("#status"));
  log("maximum a:", await text("#lambdaVal"));
  await shot("max");

  if (!first) return; // the dark run only needs the two screenshots

  // Keyboard only: two moves, and the focus must stay on the picture.
  await page.locator("#chaosCanvas").focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  const focused = await page.evaluate(() => (document.activeElement && document.activeElement.id) || "");
  log("focus after two keyboard moves:", focused);
  if (focused !== "chaosCanvas") throw new Error("keyboard moves took focus off the canvas");
  log("after keyboard moves:", await text("#status"));
  log("a after Home:", await text("#lambdaVal"));

  // The other option extreme: a = 0.7 again, one resting spot.
  await setSlider("0.7");
  log("minimum option:", await text("#status"));
  log("a after min:", await text("#lambdaVal"));
  await shot("min");

  // Every button, in the order a player would press them.
  await page.click("#newBtn");
  log("after New starting point:", await text("#status"));
  await page.click("#playBtn");
  log("after Play/Pause:", await text("#status"));
  await page.click("#stepBtn");
  log("after Take one step:", await text("#status"));
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));
  await idle();
  await shot("buttons");

  // A tap on the right-hand picture chooses a; a tap on the left pauses.
  const box = await page.locator("#chaosCanvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.5);
  log("after tapping the right picture:", await text("#status"));
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.5);
  log("after tapping the left picture:", await text("#status"));
  await shot("taps");
};
