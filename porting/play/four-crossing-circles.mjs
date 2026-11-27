// Four Crossing Circles: an illustration, so there is no win or loss.  Show
// two very different configurations, then move a point with the keyboard.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs four-crossing-circles
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
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  // Handles are in the applet's order A, B, C, D, O.
  await page.click("#names");
  await page.click("#hint");
  await drag(3, { x: 370, y: 160 }); // D far to the right
  await drag(4, { x: 230, y: 210 }); // O low down
  log("configuration 1:", await text("#status"));
  await shot("configuration-1");

  await page.click("#resetBtn");
  await page.click("#hint"); // off
  await drag(2, { x: 60, y: 160 }); // C far to the left
  await drag(4, { x: 160, y: 80 }); // O high up
  log("configuration 2:", await text("#status"));
  await shot("configuration-2");

  // Keyboard alone: focus O, press two arrow keys, and keep the focus there.
  await page.evaluate(() => {
    document.querySelectorAll("#board .geom-handle")[4].focus();
  });
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  log("after arrow keys:", await text("#status"));
  log("focus kept on O:", await page.evaluate(() => {
    const h = document.querySelectorAll("#board .geom-handle")[4];
    return document.activeElement === h;
  }));
  await shot("keyboard");

  if (!first) return;
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
