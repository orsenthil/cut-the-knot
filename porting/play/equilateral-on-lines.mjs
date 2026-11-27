// Equilateral On Lines: a drawing, not a game. Show the two rotations, then
// shift the lines and slide C1 and C2 onto one answer so the status says the
// triangle is equilateral. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs equilateral-on-lines
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = (i) => page.evaluate((idx) => {
    const h = [...document.querySelectorAll("#board .geom-handle")][idx];
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, i);

  const drag = async (i, to) => {
    const from = await handlePos(i);
    const a = await client(from.x, from.y);
    const b = await client(to.x, to.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 14 });
    await page.mouse.up();
    await idle();
  };

  const dragLine = async (i, targetY) => {
    const from = await page.evaluate((idx) => {
      const h = [...document.querySelectorAll("#board .line-hit")][idx];
      return { x: Number(h.getAttribute("x1")), y: Number(h.getAttribute("y1")) };
    }, i);
    const a = await client(150, from.y);
    const b = await client(150, targetY);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  const setAngle = (n) => page.$eval("#angle", (el, value) => {
    el.value = String(value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, n);

  // Configuration 1: the two differently oriented answers visible at once.
  await page.click("#hint");
  await setAngle(30);
  await drag(0, { x: 180, y: 120 }); // C
  await dragLine(2, 210);            // lift line L2
  log("configuration 1:", await text("#status"));
  await shot("two-answers");

  // Configuration 2: use every line button and the other options, then put
  // C1 and C2 onto the first answer and let the applet's 3px snap finish it.
  await page.click("#resetBtn");
  await setAngle(65);
  await setAngle(0);
  await page.click("#names");
  await page.click("#names");
  for (const id of ["0", "1", "2"]) {
    await page.click(`[data-line-btn="${id}"][data-dir="-1"]`);
    await page.click(`[data-line-btn="${id}"][data-dir="1"]`);
  }
  await page.click("#shuffleBtn");
  await page.click("#resetBtn");
  const answer = await page.evaluate(() => {
    const dots = [...document.querySelectorAll("#board .hint-dot")];
    const at = (n) => ({ x: Number(dots[n].getAttribute("cx")),
                        y: Number(dots[n].getAttribute("cy")) });
    return { A: at(0), B: at(1) };
  });
  await drag(1, answer.A);
  await drag(2, answer.B);
  log("configuration 2:", await text("#status"));
  log("status class:", await page.getAttribute("#status", "class"));
  await shot("matched");

  if (!first) return;
  await page.click("#hint");
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
