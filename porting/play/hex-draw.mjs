// Hex Can't End in a Draw: a board always has a winner on hex; a 4-grid checkerboard draws; the 8-grid double-wins; Gale's walk.
const paint = async (page, pattern) => {
  // Click cells until the board matches pattern(i, j) (true = red).
  const n = await page.$$eval("#board g[role=row]", (r) => r.length);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const cell = (await page.$$("#board g[role=row]"))[i];
      const p = (await cell.$$("polygon"))[j];
      const red = (await p.getAttribute("class")).includes("red");
      if (red !== pattern(i, j)) await p.click();
    }
  }
};
export default async ({ page, first, log, shot, text }) => {
  log("hex at start:", await text("#status"));
  await page.check("#walkInput");
  await shot("hex-walk");
  if (!first) return;
  await page.selectOption("#nInput", "4");
  await page.selectOption("#gridInput", "sq4");
  await paint(page, (i, j) => (i + j) % 2 === 0);
  log("4-grid checkerboard:", await text("#status"));
  await page.selectOption("#gridInput", "sq8");
  await paint(page, (i, j) => (i + j) % 2 === 0);
  log("8-grid checkerboard:", await text("#status"));
  await shot("sq8-both");
  await page.selectOption("#gridInput", "hex");
  await paint(page, (i, j) => (i + j) % 2 === 0);
  log("hex checkerboard:", await text("#status"), "| walk enabled:", !(await page.$eval("#walkInput", (x) => x.disabled)));
};
