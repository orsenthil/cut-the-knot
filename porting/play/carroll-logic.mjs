// Carroll's Game of Logic: the professors example; build Barbara by tapping; a rule message; a contradiction.
const tap = async (page, svg, label) => {
  await page.focus(`#${svg} .hit[aria-label^="${label}"]`);
  await page.keyboard.press("Enter");
};
export default async ({ page, first, log, shot, text }) => {
  await page.click("#sampleBtn");
  log("example:", await page.$$eval("#saysC li", (l) => l.map((x) => x.textContent).join("; ")));
  await shot("example");
  if (!first) return;
  await page.click("#resetBtn");
  // Barbara: all m are x (some x m, no non-x m), all y are m (some y m, no y non-m).
  await tap(page, "premA", "Box x and m");
  await page.check('input[name="chip"][value="2"]');
  await tap(page, "premA", "Box non-x and m");
  await tap(page, "premB", "Box y and non-m");
  await page.check('input[name="chip"][value="1"]');
  await tap(page, "premB", "Box y and m");
  log("Barbara:", await page.$$eval("#saysC li", (l) => l.map((x) => x.textContent).join("; ")));
  await page.click("#clearA");
  await page.check('input[name="chip"][value="2"]');
  await tap(page, "premA", "Box non-x and m");
  await tap(page, "premA", "Box x and m");
  log("no m at all + some y are m:", await text("#status"));
  await page.click("#resetBtn");
  await page.check('input[name="chip"][value="2"]');
  await tap(page, "premA", "Line");
  log("grey on a line:", await text("#status"));
};
