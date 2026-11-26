// The 1089 demo: try the worked example, take both options to their extremes,
// press every button and switch Autonomous digits both ways.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs s1089

export default async ({ page, log, shot, text }) => {
  const lines = async () =>
    (await page.locator(".number").allTextContents()).join(" | ");
  const digits = async () => (await page.locator("#digits .digit").allTextContents()).join("");

  log("at the start:", await digits(), "| lines:", await lines());
  log("at the start, status:", await text("#status"));
  await shot("start");

  // Every option at its maximum: base 36 and 15 digits. The number slides
  // sideways inside the stage rather than shrinking past a fingertip.
  await page.fill("#baseInput", "36");
  await page.press("#baseInput", "Tab");
  await page.fill("#countInput", "15");
  await page.press("#countInput", "Tab");
  log("at maximum: base", await page.inputValue("#baseInput"),
    "digits", await page.inputValue("#countInput"), "number", await digits());
  log("status at maximum:", await text("#status"));
  await shot("maximum");

  // Base 36 at 15 digits trips the applet's long-overflow quirk, so use base
  // ten to see the full-length layout slide sideways on a phone.
  await page.fill("#baseInput", "10");
  await page.press("#baseInput", "Tab");
  log("15 digits in base ten:", await digits(), "| overflow in the stage:",
    await page.evaluate(() => document.querySelector(".calc").scrollWidth - document.querySelector(".calc").clientWidth));
  await shot("fifteen-digits");

  // Two moves with the keyboard alone, checking focus survives each one.
  await page.locator("#digits .digit").nth(1).focus();
  await page.keyboard.press("ArrowRight");
  let focus = await page.evaluate(() => {
    const a = document.activeElement;
    return a && a.className + ":" + (a.dataset ? a.dataset.index : "");
  });
  log("after one ArrowRight, focus:", focus, "| number:", await digits());
  await page.keyboard.press("ArrowLeft");
  focus = await page.evaluate(() => {
    const a = document.activeElement;
    return a && a.className + ":" + (a.dataset ? a.dataset.index : "");
  });
  log("after one ArrowLeft, focus:", focus, "| status:", await text("#status"));
  await shot("keyboard");

  // Press every button in the order a player would: both option steppers,
  // each half of a digit, then Autonomous digits and New number.
  for (const id of ["baseDown", "baseUp", "countDown", "countUp"]) {
    await page.click(`#${id}`);
    log(`${id}: base ${await page.inputValue("#baseInput")}, digits ${await page.inputValue("#countInput")}`);
  }
  const digit = page.locator("#digits .digit").first();
  const box = await digit.boundingBox();
  await page.click("#digits .digit >> nth=0", { position: { x: 4, y: box.height / 2 } });
  log("after tapping the left half of digit 1:", await digits(), "|", await text("#status"));
  await page.click("#digits .digit >> nth=0", { position: { x: box.width - 4, y: box.height / 2 } });
  log("after tapping the right half of digit 1:", await digits());
  await page.check("#autonomous");
  log("Autonomous digits on:", await text("#status"));
  await page.uncheck("#autonomous");
  log("Autonomous digits off:", await text("#status"));
  await page.click("#randomBtn");
  log("New number:", await text("#status"));
  await shot("buttons");

  // Both extremes for each option: below the minimum and above the maximum.
  for (const value of ["1", "100"]) {
    await page.fill("#baseInput", value);
    await page.press("#baseInput", "Tab");
    log(`base entered as ${value} follows the applet and shows`, await page.inputValue("#baseInput"));
  }
  for (const value of ["0", "99"]) {
    await page.fill("#countInput", value);
    await page.press("#countInput", "Tab");
    log(`digits entered as ${value} follows the applet and shows`, await page.inputValue("#countInput"));
  }
  await shot("extremes");

  // Set the page's worked example, 732, by tapping the right half of each
  // digit, and read the answer that appears in words.
  await page.fill("#baseInput", "10");
  await page.press("#baseInput", "Tab");
  await page.fill("#countInput", "3");
  await page.press("#countInput", "Tab");
  const targets = [7, 3, 2];
  for (let i = 0; i < targets.length; i++) {
    const button = page.locator("#digits .digit").nth(i);
    await button.focus();
    let current = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf((await button.textContent()).trim());
    while (current !== targets[i]) {
      await page.keyboard.press(current < targets[i] ? "ArrowRight" : "ArrowLeft");
      current = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf((await button.textContent()).trim());
    }
  }
  log("the worked example:", await digits(), "| lines:", await lines());
  log("final status:", await text("#status"));
  log("final status class:", await page.getAttribute("#status", "class"));
  await shot("final");
};
