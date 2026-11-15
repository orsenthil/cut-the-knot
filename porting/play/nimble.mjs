// Nimble: a win with one chip, played with the keyboard; then a loss with two
// chips; then the largest board, to look at on a phone.
export default async ({ page, first, log, shot, idle, text }) => {
  const over = async () => /won/i.test(await text("#status"));

  // Win: one chip, picked up and sent home with the keyboard alone.
  await page.locator(".chip:not(:disabled)").first().focus();
  await page.keyboard.press("Enter");
  await page.locator('.spot[data-pos="0"]').focus();
  await page.keyboard.press("Enter");
  log("1-chip win, by keyboard:", await text("#status"), "|", await text("#score"));
  await shot("win");

  if (!first) return;

  // Loss: two chips, always sending the first one home. The computer then
  // has a single chip left and takes it home.
  await page.selectOption("#chipsInput", "2");
  for (let steps = 0; steps < 30 && !(await over()); steps++) {
    await page.locator(".chip:not(:disabled)").first().click();
    await page.locator(".spot").first().click();
    await idle(() => !/Thinking/.test(document.getElementById("status").textContent));
  }
  log("2-chip play:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  // The largest board: 30 positions and 12 chips, with one chip picked up.
  await page.selectOption("#lengthInput", "30");
  await page.selectOption("#chipsInput", "12");
  await page.locator(".chip:not(:disabled)").first().click();
  await shot("largest");
};
