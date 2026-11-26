// Permutations as a Product of Transpositions: two shuttles, follow a slide, a refused height, then 20 poles.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs perm-by-trans
export default async ({ page, first, log, shot, text }) => {
  await page.click('#board circle[aria-label="Pole 1, height 2"]');
  await page.click('#board circle[aria-label="Pole 3, height 2"]');
  await page.click('#board circle[aria-label="Pole 3, height 4"]');
  await page.click('#board circle[aria-label="Pole 5, height 4"]');
  await page.click('#board circle.num >> nth=0');
  log("slide:", await text("#status"));
  log("facts:", await text("#facts"));
  await shot("slide");
  if (!first) return;
  await page.fill("#nIn", "20");
  await page.dispatchEvent("#nIn", "change");
  await page.click('#board circle[aria-label="Pole 1, height 1"]');
  await page.click('#board circle[aria-label="Pole 20, height 1"]');
  await shot("twenty");
};
