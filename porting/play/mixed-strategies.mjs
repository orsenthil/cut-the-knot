// Mixed Strategies: show a mixed equilibrium, then a saddle point.
export default async ({ page, first, log, shot, text }) => {
  const payoffs = page.locator(".payoff");
  const change = async (cell, direction, times) => {
    for (let n = 0; n < times; n++) {
      const button = payoffs.nth(cell);
      const box = await button.boundingBox();
      await button.click({ position: { x: box.width * (direction > 0 ? .75 : .25), y: box.height / 2 } });
    }
  };

  // Matching pennies: [1 -1; -1 1].
  await change(0, 1, 1);
  await change(1, -1, 1);
  await change(2, -1, 1);
  await change(3, 1, 1);
  log("mixed:", await text("#result"));
  await shot("mixed");

  if (!first) return;
  await page.click("#resetBtn");
  // [3 1; 4 2] has a saddle at row 1, column 2.
  await change(0, 1, 3);
  await change(1, 1, 1);
  await change(2, 1, 4);
  await change(3, 1, 2);
  log("saddle:", await text("#result"));
  await shot("saddle");
};
