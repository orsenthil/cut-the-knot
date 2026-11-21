// Jefferson apportionment demo: edit a population, use steppers, change the
// divisor and reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs jefferson-apportionment

export default async ({ page, first, log, shot, text }) => {
  const total = () => page.locator(".jeff-table tr.totals td:last-child").textContent();
  log("start:", await text("#status"), "| total:", await total());
  await shot("start");

  if (first) {
    const input = page.locator('input[data-part="population"][data-index="0"]');
    await input.fill("450");
    await input.press("Enter");
    log("after a keyboard edit:", await text("#status"), "| total:", await total());
    await shot("keyboard");
  }

  await page.click("#seatsMore");
  await page.click("#seatsLess");
  await page.click("#statesMore");
  await page.click("#statesLess");
  log("after all controls:", await text("#status"), "| total:", await total());
  await shot("controls");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"), "| total:", await total());
  await shot("reset");
};
