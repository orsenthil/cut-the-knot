// The MIU System: make MIU, MIUIU, MIIII (an ambiguous rule 3), choose a place, remove last, start again.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs miu-system
export default async ({ page, first, log, shot, text }) => {
  const rule = (n) => page.locator("#rules4 button").nth(n - 1);
  const words = () => page.locator("#list li").allTextContents();
  log("start:", (await words()).join(","), "| rules enabled:", await page.locator("#rules4 button:not(:disabled)").count());
  await shot("start");
  await rule(2).click(); await rule(2).click();          // MII, MIIII
  log("after two doublings:", (await words()).join(","), "| rule 3 enabled:", await rule(3).isEnabled());
  await rule(3).click();
  log("rule 3 is ambiguous: picking panel shown:", await page.locator("#pick").isVisible(), "| rules disabled:", await page.locator("#rules4 button:disabled").count());
  await shot("choose a place");
  await page.locator("#pick button").first().click();
  log("after choosing:", (await words()).slice(0, 2).join(","), "|", await text("#status"));
  await shot("after choice");
  if (!first) return;
  await page.click("#removeBtn");
  log("after Remove last:", (await words()).slice(0, 2).join(","));
  await rule(3).click(); await page.locator("#pick button").last().click().catch(() => {});
  await rule(3).click().catch(() => {});
  await page.click("#resetBtn");
  log("after start again:", (await words()).join(","), "| remove disabled:", await page.locator("#removeBtn").isDisabled());
};
