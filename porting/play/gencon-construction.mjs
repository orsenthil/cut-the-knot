// GenCon demo: drag a centre, change an angle to the breakdown case and back.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs gencon-construction

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("polygon vertices:", await page.locator(".vertex").count());
  await shot("start");

  if (first) {
    const handle = await page.locator('.handle[data-index="0"]').boundingBox();
    const box = await page.locator("#board").boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.7, { steps: 6 });
    await page.mouse.up();
    log("after dragging a centre:", await text("#status"));
    await shot("dragged");
  }

  const input = page.locator('.control-row input').first();
  await input.fill("180");
  await input.press("Enter");
  log("with a 180 degree angle:", await text("#status"));
  await shot("angle");
};
