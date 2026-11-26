// Suan pan: five ones become a five, a ten carries, 99 + 1 ripples;
// keyboard; base 20 with 10 wires; reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs suan-pan
export default async ({ page, first, log, shot, text }) => {
  const bead = (w, b) => `#board .bead[data-wire="${w}"][data-bead="${b}"]`;
  await page.click(bead(6, 0));
  log("five ones on the last wire:", await text("#status"));
  await page.waitForTimeout(1600);
  log("after the pause:", await text("#status"));
  await page.click(bead(6, 1));
  await page.click(bead(5, 1));
  await page.click(bead(5, "h0"));
  await page.waitForTimeout(400);
  log("99:", await text("#status"));
  await page.click(bead(6, 0));
  await page.waitForTimeout(300);
  await shot("tidying");
  await page.waitForTimeout(6000);
  log("99 + 1:", await text("#status"));
  await shot("100");
  if (!first) return;
  await page.focus('#board .bead[tabindex="0"]');
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("keyboard on the heaven bead:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.wire + "/" + document.activeElement.dataset.bead));
  await page.selectOption("#radixSel", "20");
  await page.selectOption("#wiresSel", "10");
  await page.click(bead(9, "h1"));
  await page.waitForTimeout(3000);
  log("base 20, two heaven beads:", await text("#status"));
  await shot("base20");
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
