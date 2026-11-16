export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#countersInput", "1");
  await page.selectOption("#stepInput", "3");
  await page.selectOption("#lengthInput", "8");
  await page.click("#resetBtn");
  await idle();

  // Two keyboard moves
  await page.locator(".chip:not(:disabled)").first().focus();
  await page.keyboard.press("Enter");
  await page.locator(".col.target").first().focus();
  await page.keyboard.press("Enter");
  await idle(() => !/Thinking/.test(document.getElementById("status").textContent || ""));
  log("after a move:", await text("#status"));
  await shot("mid");

  if (!first) return;

  if (await page.locator("#backBtn").isEnabled()) {
    await page.click("#backBtn");
    log("after Back:", await text("#status"));
  }

  await page.selectOption("#hintInput", "3");
  await shot("modular");
  await page.selectOption("#countersInput", "5");
  await page.selectOption("#lengthInput", "20");
  await page.selectOption("#stepInput", "6");
  await shot("largest");
  await page.selectOption("#countersInput", "1");
  await page.selectOption("#lengthInput", "5");
  await page.selectOption("#stepInput", "2");
  await shot("smallest");
};
