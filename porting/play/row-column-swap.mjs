export default async ({ page, first, log, shot, text }) => {
  await page.selectOption("#nInput", "3");
  // Two keyboard swaps
  await page.locator('#rowArrows .arrow').nth(0).focus();
  await page.keyboard.press("Enter");
  await page.locator('#rowArrows .arrow').nth(1).focus();
  await page.keyboard.press("Enter");
  log("after row swap:", await text("#status"));
  await shot("swap");
  if (!first) return;

  await page.locator('#colArrows .arrow').nth(0).click();
  await page.locator('#colArrows .arrow').nth(2).click();
  await page.click("#backBtn");
  log("after Take back:", await text("#status"));
  await shot("back");

  await page.selectOption("#nInput", "10");
  await shot("largest");
  await page.selectOption("#nInput", "2");
  await shot("smallest");
};
