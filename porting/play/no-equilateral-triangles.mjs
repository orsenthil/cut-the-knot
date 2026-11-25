// No Equilateral Triangles: set a colouring with exactly one blue triangle, then try them all.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs no-equilateral-triangles
export default async ({ page, first, log, shot, text }) => {
  const dots = page.locator(".dot");
  // Aim for the colouring with the fewest blue triangles: find one by the core's own search.
  const best = await page.evaluate(() => {
    const C = NoEquilateralTrianglesCore;
    for (let b = 0; b < 1024; b++) if (C.mono(C.fromBits(b)).length === 1) return C.fromBits(b).colours;
  });
  const now = await page.evaluate(() => NoEquilateralTrianglesCore && Array.from(document.querySelectorAll(".dot")).map((d) => (d.textContent === "R" ? 1 : 0)));
  for (let i = 0; i < 10; i++) if (now[i] !== best[i]) await dots.nth(i).click();
  log("best colouring:", await text("#readout"));
  await shot("one triangle");
  if (!first) return;
  await page.click("#checkBtn");
  log("every colouring:", await text("#status"));
  await shot("proof");
  await page.click("#newBtn");
  log("new colours:", await text("#readout"));
};
