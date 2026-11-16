export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#moveInput", "3");
  await page.selectOption("#heapInput", "15");
  await page.click("#resetBtn");
  await idle();

  const sq = page.locator(".square:not(:disabled)").first();
  await sq.focus();
  await page.keyboard.press("Enter");
  await idle(() => !/Thinking/.test(document.getElementById("status").textContent || ""));
  log("after a take:", await text("#status"));
  await shot("mid");

  if (!first) return;

  if (await page.locator("#backBtn").isEnabled()) {
    await page.click("#backBtn");
    log("after Back:", await text("#status"));
  }
  await page.selectOption("#heapInput", "36");
  await page.selectOption("#moveInput", "10");
  await shot("largest");
  await page.selectOption("#heapInput", "2");
  await page.selectOption("#moveInput", "2");
  await shot("smallest");
};
