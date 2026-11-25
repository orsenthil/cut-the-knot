// The Monty Hall Problem: pick a door, then the next round, then 100 rounds.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs monty-hall
export default async ({ page, first, log, shot, text }) => {
  const doors = page.locator(".door");
  log("start:", await doors.count(), "doors");
  await shot("closed");
  await doors.nth(1).click();
  log("picked door 2:", await text("#msg"), "| open doors:", await page.locator(".door.open").count());
  await shot("opened");
  await doors.nth(0).click();
  log("next round:", await text("#tTrials"), "rounds | stay+switch won:", await text("#tStayedWon"), "+", await text("#tSwitchedWon"));
  if (!first) return;
  for (let i = 0; i < 5; i++) await page.click("#runBtn");
  log("500 more rounds:", await text("#tTrials"), "|", await text("#status"));
  await shot("many");
  await page.click("#resetBtn");
  log("after reset:", await text("#tTrials"), "| open:", await page.locator(".door.open").count());
};
