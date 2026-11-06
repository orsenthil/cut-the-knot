// Euclid's Game: play the perfect choice (start or let the computer start), win; an illegal click; sizes.
const notThinking = () => !/Thinking/.test(document.getElementById("status").textContent);
export default async ({ page, first, log, shot, idle, text }) => {
  const setup = async () => {
    // Choose who starts from the forecast, as the math section suggests.
    const f = await page.evaluate(() => {
      const nums = [...document.querySelectorAll(".num.start")].map((b) => Number(b.textContent));
      const g = EuclidGameCore.gcd(nums[0], nums[1]);
      return Math.max(...nums) / g - 2;
    });
    if (f % 2 === 0) { await page.click("#startBtn"); await idle(notThinking); }
    return f;
  };
  const f = await setup();
  for (let i = 0; i < 200 && !/won/.test(await text("#status")); i++) {
    const x = await page.evaluate(() => {
      const marked = [...document.querySelectorAll(".num.start, .num.you, .num.computer")].map((b) => Number(b.textContent));
      for (const a of marked) for (const b of marked) if (b > a && !marked.includes(b - a)) return b - a;
      return -1;
    });
    if (x < 0) break;
    await page.click(`#grid .num:nth-child(${x})`);
    await idle(notThinking);
  }
  log(`forecast ${f} moves; result:`, await text("#status"));
  await shot("end");
  if (!first) return;
  await page.click("#newBtn");
  // Click a number that cannot be a difference: one that is not a multiple of the gcd, or else 1.
  const bad = await page.evaluate(() => {
    const nums = [...document.querySelectorAll(".num.start")].map((b) => Number(b.textContent));
    const g = EuclidGameCore.gcd(nums[0], nums[1]);
    return g > 1 ? 1 : Math.max(...nums) + 1;
  });
  await page.click(`#grid .num:nth-child(${bad})`);
  log(`clicking ${bad}:`, await text("#status"));
  await page.selectOption("#nInput", "12");
  log("12 by 12:", await page.$$eval("#grid .num", (b) => b.length), "numbers");
};
