// Midline in Similar Triangles: drag L, switch the four boxes on, then drag the corners.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs midline-in-sim-tris
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await shot("start");
  for (const id of ["showPremise", "showStatement", "showHint"]) await page.check("#" + id);
  await shot("everything shown");
  const h = page.locator('.handle[data-n="L"]');
  const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.mouse.move(b.x + 40, b.y + 150, { steps: 8 }); await page.mouse.up();
  log("L dragged inward:", await text("#readout"));
  await shot("inward");
  if (!first) return;
  await page.locator('.handle[data-n="A"]').focus();
  await page.keyboard.press("ArrowLeft"); await page.keyboard.press("Shift+ArrowUp");
  log("keyboard moved A:", await page.locator('.handle[data-n="A"]').getAttribute("aria-valuetext"), "| focus kept:", await page.evaluate(() => document.activeElement.getAttribute("data-n")));
  await page.uncheck("#showNames");
  log("names off, handles left:", await page.locator(".handle").count());
  await page.click("#resetBtn");
  log("after reset:", await text("#readout"));
};
