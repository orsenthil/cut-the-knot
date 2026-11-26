// Sine of the Sum Formula: drag both corners, use the keyboard, show labels
// and angles, push the angles to their ends.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs sine-of-sum
export default async ({ page, first, log, shot, text }) => {
  log("start:", await text("#readout"));
  await page.check("#labelsBox");
  await page.check("#anglesBox");
  await shot("labels");
  if (!first) return;
  const h = page.locator('#boardL .handle[data-which="alpha"]');
  await h.evaluate((e) => e.scrollIntoView({ block: "center" }));
  const b = await h.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 5 });
  await page.mouse.up();
  log("dragged alpha down:", await text("#readout"), "|", await text("#status"));
  await page.focus('#boardL .handle[data-which="beta"]');
  for (let i = 0; i < 5; i++) await page.keyboard.press("PageUp");
  log("beta to the top by keyboard:", await text("#readout"), "| focus:", await page.evaluate(() => document.activeElement.dataset.which));
  await page.focus('#boardL .handle[data-which="alpha"]');
  for (let i = 0; i < 10; i++) await page.keyboard.press("PageDown");
  log("alpha to the bottom:", await text("#readout"));
  await shot("extremes");
  await page.uncheck("#labelsBox");
  await page.uncheck("#anglesBox");
  log("labels off:", await text("#readout"));
};
