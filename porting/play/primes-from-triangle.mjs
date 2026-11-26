// A Geometric Sieve of Eratosthenes: the finished picture with prime rows
// shaded, a dot's family, a step's triangle, Clear and One step, 100 rows,
// the keyboard.
// Run with: NODE_PATH=... node porting/play.mjs primes-from-triangle
export default async ({ page, first, log, shot, text }) => {
  await page.check("#primesBox");
  await page.check("#descBox"); await page.check("#ancBox"); await page.check("#sibBox");
  // Click dot (12, 8) using the page's own geometry.
  const clickDot = async (r, k) => {
    const box = await page.locator("#board").boundingBox();
    const n = Number(await page.inputValue("#rowsIn")), W = 640, H = 560, L = 34, M = 8;
    const h = Math.min((H - 2 * M) / (n + 1), (W - L - 2 * M) / (n * 2 / Math.sqrt(3) + 1)), dx = (2 * h) / Math.sqrt(3);
    const x = L + (W - L) / 2 - (r * dx) / 2 + k * dx, y = M + r * h + h / 2;
    await page.mouse.click(box.x + (x * box.width) / W, box.y + (y * box.height) / H);
  };
  await clickDot(12, 8);
  log("dot (12, 8):", await text("#info"));
  await shot("family of (12, 8)");
  if (!first) return;
  await clickDot(13, 5);
  log("dot (13, 5):", await text("#info"));
  await page.click("#clearBtn");
  for (let i = 0; i < 4; i++) await page.click("#stepBtn");
  log("after Clear and 4 steps:", await text("#info"));
  await shot("step 5");
  await page.fill("#rowsIn", "100"); await page.dispatchEvent("#rowsIn", "change");
  await page.fill("#rowsIn", "500"); await page.dispatchEvent("#rowsIn", "change");
  log("rows asked 500:", await page.inputValue("#rowsIn"));
  for (let i = 0; i < 95; i++) await page.click("#stepBtn");
  log("done:", await text("#info"), "| One step disabled:", await page.isDisabled("#stepBtn"));
  await shot("100 rows");
  await page.fill("#rowsIn", "20"); await page.dispatchEvent("#rowsIn", "change");
  await page.focus("#board");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowRight"); await page.keyboard.press("Enter");
  log("keyboard:", await text("#info"), "| focus:", await page.evaluate(() => document.activeElement.id));
  await page.keyboard.press("t");
  log("T:", await text("#info"));
};
