// Loop Or Halt: a row of 6, then 12, then keep pressing New row.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs loop-or-halt
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("six");
  await page.locator("#n").evaluate((el) => { el.value = 12; el.dispatchEvent(new Event("input", { bubbles: true })); });
  log("twelve:", await text("#status"), "|", (await text("#readout")).slice(0, 60));
  await shot("twelve");
  if (!first) return;
  for (let i = 0; i < 5; i++) await page.click("#newBtn");
  log("after 5 new rows:", await text("#status"));
  const rows = await page.locator("#rows li").count();
  log("rows shown:", rows);
};
