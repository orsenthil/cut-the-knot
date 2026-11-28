// Max Common Chord 5 is an illustration, not a game: there is no win or loss.
// Drag the chord AB to two different configurations, show both hints and both
// modes, break the chord by moving Q, then try every button and the arrow keys.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs max-common-chord-5
export default async ({ page, first, log, shot, idle, text }) => {
  // Handles are in order P, Q, A, B.
  const handlePos = (index) => page.evaluate((i) => {
    const h = document.querySelectorAll("#board .geom-handle")[i];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, index);

  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (index, to) => {
    const from = await handlePos(index);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 18 });
    await page.mouse.up();
    await idle();
  };

  await shot("start");
  log("start:", await text("#status"));

  // Configuration 1: chord mode, A pulled down along C(E); B follows so AB
  // still passes through P, and both claimed circles redraw.
  await drag(2, { x: 180, y: 195 });
  log("A dragged along its circle:", await text("#status"));
  await shot("chord-moved");

  // Configuration 2: both angle hints on, circle mode, B dragged freely.
  await page.click("#hint1Chk");
  await page.click("#hint2Chk");
  await page.click("#circlesBtn");
  await drag(3, { x: 330, y: 205 });
  log("hints on, B dragged in circle mode:", await text("#status"));
  await shot("hints-circles");

  // Applet quirk: moving P does not re-fix B, so AB can miss P.
  await drag(0, { x: 178, y: 220 });
  log("P moved, chord broken:", await text("#status"));
  await shot("broken-chord");

  // Press every button and change every option in both directions.
  await page.click("#chordBtn");
  await page.click("#circlesBtn");
  await page.click("#chordBtn");
  await page.click("#resetBtn");
  await page.click("#namesChk");
  await page.click("#namesChk");
  await page.click("#hint1Chk");
  await page.click("#hint1Chk");
  await page.click("#hint2Chk");
  await page.click("#hint2Chk");
  log("after Reset:", await text("#status"));

  if (!first) return; // the dark run only needs the screenshots above

  // Two keyboard-only moves; focus must remain on the A handle after each.
  const before = await handlePos(2);
  await page.evaluate(() => document.querySelectorAll("#board .geom-handle")[2].focus());
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await handlePos(2);
  await idle();
  log("keyboard moved A:", before.x !== after.x || before.y !== after.y);
  log("focus stays on A:", await page.evaluate(() =>
    !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
  log("after keyboard:", await text("#status"));
  await shot("keyboard");
  await shot("final");
};
