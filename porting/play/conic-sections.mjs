// Conic Sections: two configurations of the same cone and cutting plane.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs conic-sections
export default async ({ page, first, log, shot, text }) => {
  // A tilted plane below the generator angle: one closed curve on one nappe.
  await page.click('[data-preset="ellipse"]');
  log("ellipse:", await text("#status"));
  await shot("ellipse");
  if (!first) return; // the dark run only needs the screenshot above

  // Walk through the other configurations the page names.
  await page.click('[data-preset="circle"]');
  log("circle:", await text("#status"));
  await page.click('[data-preset="parabola"]');
  log("parabola:", await text("#status"));
  await page.click('[data-preset="vertex"]');
  log("through the vertex:", await text("#status"));

  // A tilt above the generator angle: the plane cuts both nappes.
  await page.click('[data-preset="hyperbola"]');
  await page.click("#opaqueBtn");
  await page.click("#linkBtn");
  log("hyperbola:", await text("#status"));
  log("family:", await text("#familyOut"));
  await shot("hyperbola");
};
