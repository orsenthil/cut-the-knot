// No Silver Dollar: a win with one counter, played with the keyboard; then a
// loss with one counter; then the largest board and Set up, to look at on a phone.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/.test(document.getElementById("status").textContent);

  // Win: one counter, picked up and sent to square 0 with the keyboard alone.
  await page.selectOption("#chipsInput", "1");
  await page.locator(".cell.counter:not(:disabled)").first().focus();
  await page.keyboard.press("Enter");
  log("focus stays on the board after a pick:", await page.evaluate(() => document.activeElement.className));
  await page.locator('.cell.target[data-pos="0"]').focus();
  await page.keyboard.press("Enter");
  log("1-counter win, by keyboard:", await text("#status"), "|", await text("#score"));
  await shot("win");

  if (!first) return;

  // Loss: move the one counter a single square, and the computer takes it home.
  await page.click("#newBtn");
  await page.locator(".cell.counter").first().click();
  await page.locator(".cell.target").last().click();
  await idle(thinking);
  log("1-counter loss:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  // Three counters: one move each, to see how the computer's move is marked.
  await page.selectOption("#chipsInput", "3");
  await page.locator(".cell.counter:not(:disabled)").last().click();
  await page.locator(".cell.target").last().click();
  await idle(thinking);
  log("after the computer's reply:", await text("#status"));
  await shot("reply");

  // The largest board: 30 squares and 12 counters, with one counter picked up.
  await page.selectOption("#lengthInput", "30");
  await page.selectOption("#chipsInput", "12");
  await page.locator(".cell.counter:not(:disabled)").first().click();
  await shot("largest");

  // Set up: a counter may go anywhere empty, to the right as well.
  await page.check("#setupInput");
  await page.locator(".cell.counter").first().click();
  await page.locator('.cell.target[data-pos="29"], .cell.target[data-pos="28"]').last().click();
  log("set up:", await text("#status"));
  await page.uncheck("#setupInput");
  log("back to play:", await text("#status"));
};
