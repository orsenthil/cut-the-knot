// Altitude Mirror 2: drag C and D to two different configurations and show
// the diagram both plain and with the Pascal hint and the equal-angle marks.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs altitude-mirror-2

/** Where a point at angle `a` sits in client pixels, in the board's SVG. */
async function atAngle(page, a) {
  return page.evaluate((angle) => {
    const svg = document.getElementById("board");
    const b = AltitudeMirror2Core.BOARD;
    const p = AltitudeMirror2Core.anglePoint(b.cx, b.cy, b.r, angle);
    const m = svg.getScreenCTM();
    const q = new DOMPoint(p.x, p.y).matrixTransform(m);
    return { x: q.x, y: q.y };
  }, a);
}

/** Centre of the draggable handle named C or D, in client pixels. */
async function handleAt(page, name) {
  return page.evaluate((which) => {
    const h = [...document.querySelectorAll("#board .geom-handle")]
      .find((n) => (n.getAttribute("aria-label") || "").includes("Point " + which));
    if (!h) throw new Error("no handle " + which);
    const r = h.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, name);
}

async function drag(page, name, angle) {
  const from = await handleAt(page, name);
  const to = await atAngle(page, angle);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 14 });
  await page.mouse.up();
}

export default async ({ page, first, log, shot, text }) => {
  // First configuration: C high on the left, D low on the right.
  await drag(page, "C", 2.75);
  await drag(page, "D", 0.35);
  const one = await text("#status");
  log("first position:", one);
  if (first && !/bisects angle CFD/.test(one)) throw new Error("status does not state the bisector claim");
  await shot("one");

  // Second configuration: both points nearer the top, with the proof shown.
  await page.click("#hintBtn");
  await page.click("#statementBtn");
  await drag(page, "C", 1.95);
  await drag(page, "D", 1.1);
  const two = await text("#status");
  log("second position:", two);
  if (first && !/equal/.test(two)) throw new Error("statement mode did not describe equal angles");
  await shot("two");

  // Buttons a player would press, then a fresh random position.
  await page.click("#namesBtn");
  await page.click("#namesBtn");
  await page.click("#newBtn");
  log("after a new position:", await text("#status"));
  await shot("new");
};
