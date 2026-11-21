// Rectangle on a Chessboard demo: drag the rectangle, resize it, centre it on
// a grid line, toggle the split and use the sliders.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs integer-rectangle

export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#status"));
  log("areas:", await text("#readout"));
  await shot("start");

  if (first) {
    const rect = await page.locator(".region").boundingBox();
    const box = await page.locator("#board").boundingBox();
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.3, { steps: 6 });
    await page.mouse.up();
    log("after dragging:", await text("#status"));
    await shot("dragged");

    const handle = await page.locator(".resize").boundingBox();
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 40, handle.y + 30, { steps: 5 });
    await page.mouse.up();
    log("after resizing:", await text("#status"));
    await shot("resized");
  }

  await page.click("#centerBtn");
  log("centred on a grid line:", await text("#status"));
  await shot("centred");

  await page.check("#splitCheck");
  log("split pieces:", await page.locator(".piece").count());
  await shot("split");

  await page.fill("#wInput", "2");
  await page.locator("#wInput").dispatchEvent("input");
  log("with an even width:", await text("#status"));
  log("areas:", await text("#readout"));
  await shot("even");
};
