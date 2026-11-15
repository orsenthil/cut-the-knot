// One Pile: a win with perfect play (the first moves by keyboard, with the
// focus kept); a loss from a losing pile; Take back and Make move; Min and Max
// changed in both directions; then the widest take row, and a take bigger than
// the pile switched off.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/.test(document.getElementById("status").textContent);
  const over = async () => /won/i.test(await text("#status"));
  const focus = () => page.evaluate(() => document.activeElement.tagName + "." + (document.activeElement.className || document.activeElement.id));
  const pile = async () => Number(await text("#pile"));

  await page.selectOption("#minInput", "3");
  await page.selectOption("#maxInput", "5");

  // Win: deal until the pile is a winning one for the player, then always leave a losing pile.
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.click("#newBtn");
    if (C_isP(await pile())) continue;
    for (let k = 0; k < 40 && !(await over()); k++) {
      const n = await pile();
      const t = await page.evaluate((n) => OnePileCore.winningMoves({ n, min: 3, max: 5, turn: "you", over: false, winner: null, history: [] })[0] || 3, n);
      if (k < 2) { // two moves by keyboard alone
        await page.locator(`.take[data-take="${t}"]`).focus();
        await page.keyboard.press("Enter");
        await idle(thinking);
        if (k === 0 && !(await over())) log("focus after the computer's reply:", await focus());
      } else {
        await page.locator(`.take[data-take="${t}"]`).click();
        await idle(thinking);
      }
    }
    break;
  }
  log("win:", await text("#status"), "|", await text("#score"));
  await shot("win");
  if (!first) return;

  // Loss: deal a losing pile and always take 3; the computer wins.
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.click("#newBtn");
    if (!C_isP(await pile())) continue;
    for (let k = 0; k < 40 && !(await over()); k++) {
      await page.locator('.take[data-take="3"]').click();
      await idle(thinking);
    }
    break;
  }
  log("loss:", await text("#status"), "|", await text("#score"));
  log("Take back after the end is off:", await page.locator("#backBtn").isDisabled());
  await shot("loss");

  // Take back, then Make move: the button must be on exactly when the status asks for it.
  for (let attempt = 0; attempt < 60; attempt++) {
    await page.click("#newBtn");
    if ((await pile()) >= 20) break; // far from the end, so the game cannot finish in one exchange
  }
  await page.locator(".take:not(:disabled)").first().click();
  await idle(thinking);
  await page.click("#backBtn");
  log("after Take back:", await text("#status"), "| Make move off:", await page.locator("#makeBtn").isDisabled());
  await page.click("#makeBtn");
  await idle(thinking);
  log("after Make move:", await text("#status"));
  await shot("makemove");

  // Min and Max the applet's way, in both directions.
  await page.selectOption("#minInput", "8");
  await page.selectOption("#maxInput", "5");
  log("Max below Min (Min 8, Max 5) gives Min/Max:", await page.inputValue("#minInput"), await page.inputValue("#maxInput"));
  await page.selectOption("#minInput", "9");
  log("Min above Max (Min 9) gives Min/Max:", await page.inputValue("#minInput"), await page.inputValue("#maxInput"));

  // A take bigger than the pile is switched off.
  await page.selectOption("#minInput", "3");
  await page.selectOption("#maxInput", "12");
  for (let k = 0; k < 40 && (await pile()) >= 12; k++) {
    await page.locator(".take:not(:disabled)").first().click();
    await idle(thinking);
    if (await over()) break;
  }
  const n = await pile();
  if (!(await over())) log(`pile ${n}: takes above it are off:`, await page.locator(".take:disabled").count() > 0);

  // The widest take row.
  await page.selectOption("#minInput", "1");
  await page.selectOption("#maxInput", "45");
  await shot("largest");
};

// The losing piles for Min 3, Max 5: the remainder on division by 8 is below 3.
function C_isP(n) { return n % 8 < 3; }
