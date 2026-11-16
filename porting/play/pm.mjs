// Plus or Minus: win on N=5 (odd triangular); lose on N=3; largest N; keyboard.
export default async ({ page, first, log, shot, idle, text }) => {
  const thinking = () => !/Thinking/i.test(document.getElementById("status").textContent);
  const over = async () => /won/i.test(await text("#status"));

  // Win: N=5, triangular 15 odd — any signs, you win.
  await page.uncheck("#randomInput");
  await page.selectOption("#nInput", "5");
  await page.check("#plusInput");
  for (let k = 0; k < 10 && !(await over()); k++) {
    const gap = page.locator(".gap:not(:disabled)").first();
    if (!(await gap.count())) break;
    if (k < 2) {
      await gap.focus();
      await page.keyboard.press("Enter");
      await idle(thinking);
      if (k === 0 && !(await over())) {
        log("focus after computer:", await page.evaluate(() => document.activeElement && (document.activeElement.getAttribute("aria-label") || document.activeElement.id)));
      }
    } else {
      await gap.click();
      await idle(thinking);
    }
  }
  log("win:", await text("#status"), "|", await text("#score"));
  await shot("win");
  if (!first) return;

  // Loss: N=3, triangular 6 even — computer always wins.
  await page.selectOption("#nInput", "3");
  for (let k = 0; k < 6 && !(await over()); k++) {
    const gap = page.locator(".gap:not(:disabled)").first();
    if (!(await gap.count())) break;
    await gap.click();
    await idle(thinking);
  }
  log("loss:", await text("#status"), "|", await text("#score"));
  await shot("loss");

  // Largest N, minus selected, one gap pressed.
  await page.selectOption("#nInput", "20");
  await page.check("#minusInput");
  await page.locator(".gap:not(:disabled)").first().click();
  await idle(thinking);
  await shot("largest");

  // Random on, Reset, then N spinner disabled.
  await page.check("#randomInput");
  log("N disabled when random:", await page.locator("#nInput").isDisabled());
  await page.click("#newBtn");
  await shot("random");
};
