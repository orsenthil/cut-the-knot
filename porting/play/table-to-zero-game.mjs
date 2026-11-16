export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#nxInput", "2");
  await page.selectOption("#nyInput", "1");
  await page.uncheck("#speedUp");
  await page.click("#resetBtn");
  await idle();
  // Subtract columns until status wins or a few clicks.
  for (let i = 0; i < 12; i++) {
    const st = await text("#status");
    if (/All zeros/i.test(st)) break;
    const btns = page.locator(".col-actions .axis:not(:disabled)");
    if ((await btns.count()) === 0) break;
    await btns.nth(i % 2).click();
    await idle();
  }
  log("status:", await text("#status"));
  await shot("mid");
  if (!first) return;
  await page.selectOption("#nxInput", "5");
  await page.selectOption("#nyInput", "3");
  await page.check("#speedUp");
  await page.click("#resetBtn");
  await idle();
  await shot("full");
};
