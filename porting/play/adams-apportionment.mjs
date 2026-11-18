// Adams' Apportionment Method demo: tune the divisor, let Find divisor do it,
// then change the population and the seat and state counts to see the table
// update. No win or loss — just a tour of the controls.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs adams-apportionment

export default async ({ page, first, log, shot, text }) => {
  log("initial:", await text("#status"));
  await shot("start");

  // The starting board already has a fitting divisor.
  log("quotas:", await page.locator(".apportion-table td").allTextContents());
  await page.click("#findBtn");
  log("after Find divisor:", await text("#status"));
  await shot("found");

  if (first) {
    // A divisor that does not fit, then a keyboard edit of a population.
    await page.fill("#divisorInput", "50");
    await page.locator("#divisorInput").press("Enter");
    log("with divisor 50:", await text("#status"));
    await shot("wrong-divisor");

    const input = page.locator('input[data-part="population"][data-index="0"]');
    await input.fill("450");
    await input.press("Enter");
    log("after a keyboard population edit:", await text("#status"));
    await shot("keyboard");
  }

  await page.click("#findBtn");
  log("after refitting:", await text("#status"));
  await shot("refitted");

  // Every control in both directions where possible.
  await page.click("#seatsMore");
  await page.click("#seatsLess");
  await page.click("#statesMore");
  await page.click("#statesLess");
  await page.click("#findBtn");
  const up = await page.locator(".apportion-table tr.totals td").last().textContent();
  log("after option changes, upward total:", up, "| seats:", await text("#seatsOut"));
  await shot("options");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
