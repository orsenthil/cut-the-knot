export default async ({ page, first, log, shot, idle, text }) => {
  await page.check("#elimInput");
  await page.selectOption("#nInput", "5");
  await page.click("#resetBtn");
  await idle();

  // Keep trying pairs until a merge lands (status no longer "Pick two"/"different").
  for (let attempt = 0; attempt < 12; attempt++) {
    const shapes = page.locator(".shape:not(.empty)");
    const n = await shapes.count();
    if (n < 2) break;
    await shapes.nth(0).click();
    const firstClass = (await shapes.nth(0).getAttribute("class")) || "";
    const kind = ["square", "circle", "triangle"].find((k) => firstClass.includes(k));
    let clicked = false;
    for (let i = 1; i < n; i++) {
      const cls = (await shapes.nth(i).getAttribute("class")) || "";
      const other = ["square", "circle", "triangle"].find((k) => cls.includes(k));
      if (kind && other && kind !== other) {
        await shapes.nth(i).click();
        clicked = true;
        break;
      }
    }
    if (!clicked) await page.keyboard.press("Escape");
    const st = await text("#status");
    if (!/Pick two|different shapes|Pick a different/i.test(st) || /Done|merge|Counts/i.test(st)) break;
    if (/Done/i.test(st)) break;
    // after a successful merge status is "Pick two" again — that's fine
    if (clicked && /Pick two different shapes/i.test(st)) break;
  }
  log("after a merge:", await text("#status"));
  await shot("mid");

  if (!first) return;

  await page.click("#repeatBtn");
  log("after Repeat:", await text("#status"));
  await page.uncheck("#elimInput");
  await page.selectOption("#nInput", "20");
  await shot("largest");
  await page.selectOption("#nInput", "3");
  await shot("smallest");
};
