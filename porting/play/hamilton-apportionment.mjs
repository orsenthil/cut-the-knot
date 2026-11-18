// Hamilton's Apportionment Method demo: change the seat count to trigger the
// Alabama paradox, edit a population, then exercise every control.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hamilton-apportionment

export default async ({ page, first, log, shot, text }) => {
  const finals = () => page.locator(".apportion-table tr:not(.totals) td:last-child").allTextContents();
  log("initial:", await text("#status"), "| final:", (await finals()).join(" "));
  await shot("start");

  // One more seat can cost a state a seat.
  const before = await finals();
  await page.click("#seatsMore");
  const after = await finals();
  log("seats:", await text("#seatsOut"), "| before:", before.join(" "), "| after:", after.join(" "));
  await shot("more-seats");

  if (first) {
    const input = page.locator('input[data-part="population"][data-index="0"]');
    await input.fill("450");
    await input.press("Enter");
    log("after a keyboard population edit:", await text("#status"));
    await shot("keyboard");
    await page.click("#seatsLess");
    await page.click("#statesMore");
    await page.click("#statesLess");
    log("after option changes:", await text("#status"));
    await shot("options");
  }

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
  await shot("reset");
};
