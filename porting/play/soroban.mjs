// Soroban: build 7 on the last wire, trade four ones for a five, use the
// keyboard, try base 2, base 20 with 10 wires, reset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs soroban
export default async ({ page, first, log, shot, text }) => {
  const bead = (w, b) => `#board .bead[data-wire="${w}"][data-bead="${b}"]`;
  await page.click(bead(6, 0));
  log("four earth beads on the last wire:", await text("#status"));
  await page.click(bead(6, "heaven"));
  log("heaven bead: four ones become five:", await text("#status"));
  await page.click(bead(6, 2));
  await page.click(bead(5, "heaven"));
  log("57:", await text("#status"));
  await shot("57");
  if (!first) return;
  await page.focus('#board .bead[tabindex="0"]');
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  log("keyboard on wire 2:", await text("#status"), "| focus:", await page.evaluate(() => document.activeElement.dataset.wire + "/" + document.activeElement.dataset.bead));
  await page.selectOption("#radixSel", "2");
  for (let w = 0; w < 7; w++) await page.click(bead(w, "heaven"));
  log("base 2, all ones:", await text("#status"));
  await page.selectOption("#radixSel", "20");
  await page.selectOption("#wiresSel", "10");
  await page.click(bead(9, 0));
  await page.click(bead(9, "heaven"));
  log("base 20:", await text("#status"));
  await shot("base20");
  await page.click("#resetBtn");
  log("reset:", await text("#status"));
};
