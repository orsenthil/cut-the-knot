// Proizvolov's Identity: finish a selection (done); Take back; largest N; keyboard.
export default async ({ page, first, log, shot, idle, text }) => {
  const done = async () => /N²|N\u00b2|done|Every split/i.test(await text("#status"));

  await page.selectOption("#nInput", "4");
  // Pick four numbers with the keyboard for the first two.
  const picks = [8, 1, 5, 3];
  for (let i = 0; i < picks.length; i++) {
    const btn = page.locator(`.num[data-value="${picks[i]}"]:not(:disabled)`);
    if (i < 2) {
      await btn.focus();
      await page.keyboard.press("Enter");
    } else {
      await btn.click();
    }
  }
  log("done:", await text("#status"));
  log("sum box:", await page.locator("#sumBox").innerText());
  await shot("done");
  if (!first) return;

  // Clue on, then Take back.
  await page.check("#clueInput");
  log("clue rows:", await page.locator("#sumBox").innerText());
  await page.click("#backBtn");
  log("after Take back:", await text("#status"), "| clue disabled:", await page.locator("#clueInput").isDisabled());
  await shot("back");

  // Finish again for a second done screenshot, then largest N.
  await page.locator(".num:not(:disabled)").first().click();
  await shot("again");

  await page.selectOption("#nInput", "15");
  await page.locator(".num:not(:disabled)").first().click();
  await shot("largest");

  await page.click("#newBtn");
  log("reset:", await text("#status"));
};
