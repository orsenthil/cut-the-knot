// Pick's Theorem: a quadrilateral with dots inside, a bow tie that crosses, then a delete.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs pick
export default async ({ page, first, log, shot, text }) => {
  const click = async (x, y) => {
    const box = await page.locator("#board").boundingBox();
    await page.mouse.click(box.x + ((24 + x * 32) / 464) * box.width, box.y + ((24 + y * 32) / 336) * box.height);
  };
  for (const [x, y] of [[2, 2], [8, 2], [8, 6], [2, 6]]) await click(x, y);
  log("rectangle:", await text("#readout"));
  await shot("rectangle");
  if (!first) return;
  await page.click("#resetBtn");
  for (const [x, y] of [[2, 2], [8, 6], [8, 2], [2, 6]]) await click(x, y);
  log("bow tie:", await text("#readout"));
  await shot("bowtie");
  await page.check("#delMode");
  await click(2, 6);
  log("after delete:", await text("#readout"));
  await shot("deleted");
};
