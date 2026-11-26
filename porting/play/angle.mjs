// Angle: drag each ray to a new position, then show a signed reflex preset.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs angle
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const svg = document.getElementById("board");
    const m = svg.getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const drag = async (handleIndex, from, to) => {
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  // First configuration: turn ray OA from the east to the top of the circle.
  // The measured angle stays 30 degrees, as in the Java applet.
  await drag(0, { x: 256, y: 120 }, { x: 180, y: 44 });
  log("after dragging OA:", await text("#status"));
  await shot("acute");

  if (!first) return; // the dark run only needs the screenshot above

  // Second configuration: signed mode, and drag OB clockwise 150 degrees.
  await page.click("#signedBox");
  const b = await page.evaluate(() => {
    const h = [...document.querySelectorAll("#board .geom-handle")][1];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });
  await drag(1, b, { x: 218, y: 186 });
  log("after dragging OB:", await text("#status"));
  await shot("negative-obtuse");

  // Step past straight into reflex, and check the number box follows.
  await page.click('[data-angle="270"]');
  log("reflex preset:", await text("#status"), "| input:", await page.inputValue("#degreeInput"));
  await page.click("#plusBtn");
  log("one degree more:", await text("#status"));
};
