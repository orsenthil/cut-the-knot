// Five Methods of Apportionment: change every control, edit a population and
// confirm all five columns still add to the number of seats.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs apportionment-methods

export default async ({ page, first, log, shot, text }) => {
  const totals = () => page.locator(".compare-table tr.totals td").allTextContents();
  log("initial:", await text("#status"), "| totals:", (await totals()).join(" "));
  await shot("start");

  await page.selectOption("#methodSelect", "webster");
  log("Webster detail:", await page.locator(".detail").textContent());
  await shot("webster");

  if (first) {
    const input = page.locator('input[data-part="population"][data-index="0"]');
    await input.fill("450");
    await input.press("Enter");
    log("after a keyboard population edit:", await text("#status"));
    log("totals:", (await totals()).join(" "));
    await shot("keyboard");
  }

  await page.click("#seatsMore");
  await page.click("#seatsLess");
  await page.click("#statesMore");
  await page.click("#statesLess");
  await page.selectOption("#methodSelect", "huntington-hill");
  log("after all controls:", await text("#status"), "| totals:", (await totals()).join(" "));
  await shot("controls");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
