// Critical path demo: try each preset, change processor count and reorder
// the priority list.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs critical-path-scheduling

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  await shot("start");

  await page.selectOption("#procSel", "4");
  log("four processors:", await text("#status"));
  await shot("four");

  if (first) {
    await page.selectOption("#presetSel", "parallel");
    log("parallel project:", await text("#status"));
    await shot("parallel");
    const up = page.locator(".priority-row").nth(1).locator("button").first();
    await up.click();
    log("after reordering:", await text("#status"));
    await shot("priority");
  }

  await page.selectOption("#presetSel", "branches");
  await page.selectOption("#procSel", "1");
  log("one processor:", await text("#status"));
  await shot("one");
};
