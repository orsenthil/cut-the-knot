// Scout out of Desert: 3-move win on 4×(3+2); Take back; Set position; largest.
export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#colsInput", "4");
  await page.selectOption("#habInput", "3");
  await page.selectOption("#levelInput", "2");

  const path = [
    { from: [2, 0], to: [2, 2] },
    { from: [2, 2], to: [0, 2] },
    { from: [2, 1], to: [2, 3] },
  ];
  for (let i = 0; i < path.length; i++) {
    const { from, to } = path[i];
    const a = page.locator(`.cell[data-x="${from[0]}"][data-y="${from[1]}"]`);
    const b = page.locator(`.cell[data-x="${to[0]}"][data-y="${to[1]}"]`);
    if (i < 2) {
      await a.focus();
      await page.keyboard.press("Enter");
      await b.focus();
      await page.keyboard.press("Enter");
    } else {
      await a.click();
      await b.click();
    }
  }
  log("win:", await text("#status"));
  await shot("win");
  if (!first) return;

  await page.click("#newBtn");
  await page.locator('.cell[data-x="2"][data-y="0"]').click();
  await page.locator('.cell[data-x="2"][data-y="2"]').click();
  await page.click("#backBtn");
  log("after Take Back:", await text("#status"), "| back off:", await page.locator("#backBtn").isDisabled());
  await shot("back");

  await page.check("#setPosInput");
  await page.locator('.cell[data-x="0"][data-y="0"]').click();
  await shot("setpos");

  await page.selectOption("#colsInput", "10");
  await page.selectOption("#habInput", "10");
  await page.selectOption("#levelInput", "5");
  await shot("largest");
};
