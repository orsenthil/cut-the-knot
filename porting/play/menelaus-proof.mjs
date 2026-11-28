// Menelaus Proof: two configurations of the same construction.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs menelaus-proof
export default async ({ page, first, log, shot, text }) => {
  // Configuration 1: Proof #1, with corner A moved by arrow keys alone.
  await page.click("#proof1Btn");
  const handles = page.locator("#board .geom-handle");
  await handles.nth(0).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  log("proof 1:", await text("#status"));
  await shot("proof1");

  if (!first) return; // the dark run only needs the first screenshot

  // Configuration 2: a fresh diagram, point names on, Proof #3, dragging E.
  await page.click("#newBtn");
  await page.click("#namesBtn");
  await page.click("#proof3Btn");
  await handles.nth(4).focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  log("proof 3:", await text("#status"));
  await shot("proof3");
};
