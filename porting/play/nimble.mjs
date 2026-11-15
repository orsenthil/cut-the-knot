// Nimble: win with 1 chip (instant), lose with 2 chips (XOR=0).
export default async ({ page, first, log, shot, idle, text }) => {
  const over = async () => /won|wins/i.test(await text("#status"));
  // Win: 1 chip, move it to 0 directly.
  // Default is 1 chip on length 7.
  const chipBtn = () => page.locator(".chip:not(.home)").first();
  await chipBtn().click();
  // Click position 0 (the first needle-col which is the target)
  await page.locator(".needle-col.target").first().click();
  log("1-chip win:", await text("#status"));
  await shot("win");

  if (!first) return;

  // Loss: 2 chips with same position (XOR=0).
  await page.selectOption("#chipsInput", "2");
  // Make random moves until the computer wins.
  let steps = 0;
  while (!(await over()) && steps < 30) {
    steps++;
    const chips = page.locator(".chip:not(.home):not([disabled])");
    const count = await chips.count();
    if (count === 0) break;
    await chips.first().click();
    const targets = page.locator(".needle-col.target");
    const tCount = await targets.count();
    if (tCount === 0) break;
    await targets.first().click();
    // Wait for computer
    await idle(() => !/Thinking/.test(document.getElementById("status").textContent));
  }
  log("2-chip play:", await text("#status"));
};
