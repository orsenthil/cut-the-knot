// Cut the Cylinder: two configurations of the cylinder and its cutting sheet.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs cut-cylinder
export default async ({ page, first, log, shot, text }) => {
  // A sloping sheet: the side view shows a tilted sheet and the face-on view
  // shows the ellipse it cuts out of the cylinder.
  await page.click('[data-preset="ellipse"]');
  log("tilted sheet:", await text("#status"));
  await shot("ellipse");
  if (!first) return; // the dark run only needs the screenshot above

  // Walk through the other shapes named on the page.
  await page.click('[data-preset="circle"]');
  log("straight across:", await text("#status"));
  await page.click('[data-preset="touch"]');
  log("just touching:", await text("#status"));

  // A sheet running along the axis: two parallel lines, which join at touch.
  await page.click('[data-preset="lines"]');
  await page.click("#opaqueBtn");
  await page.click("#linkBtn");
  log("along the axis:", await text("#status"));
  log("shape:", await text("#familyOut"));
  await shot("parallel-lines");
};
