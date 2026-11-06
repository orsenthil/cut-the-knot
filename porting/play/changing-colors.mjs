// Changing Colors II: swap a few lines, the hint count stays odd; take back; numbers view; sizes.
export default async ({ page, first, log, shot, text }) => {
  await page.check("#hintInput");
  const arrows = await page.$$("#board .arrow");
  for (const i of [0, 7, 15, 20, 31]) {
    await arrows[i].focus();
    await page.keyboard.press("Enter");
  }
  log("after five moves:", await text("#countLine"));
  await shot("hint");
  if (!first) return;
  await page.click("#backBtn");
  log("take back:", await text("#countLine"));
  await page.selectOption("#viewInput", "numbers");
  log("numbers view, -1 count:", await page.$$eval("#board .num", (t) => t.filter((x) => x.textContent === "-1").length));
  await shot("numbers");
  for (const n of ["4", "8"]) {
    await page.selectOption("#nInput", n);
    log(`size ${n}:`, await page.$$eval("#board .arrow", (a) => a.length), "arrows |", await text("#countLine"));
  }
};
