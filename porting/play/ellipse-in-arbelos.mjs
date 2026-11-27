// Ellipse in Arbelos: two different configurations of the diagram, then every
// control and a keyboard-only drag. No win or loss: this is an illustration.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs ellipse-in-arbelos
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  const handlePos = () => page.evaluate(() => {
    const h = document.querySelector("#board .geom-handle");
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });

  const dragC = async (toX) => {
    const from = await handlePos();
    const a = await client(from.x, from.y);
    const b = await client(toX, from.y);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 16 });
    await page.mouse.up();
    await idle();
  };

  const setRange = async (selector, value) => {
    await page.$eval(selector, (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, value);
    await idle();
  };

  await shot("start");
  log("start:", await text("#status"));

  // Configuration 1: C near B, so a1 is large and the chain circles are wide.
  await setRange("#nRange", 8);
  await dragC(245);
  log("configuration 1 (8 circles, C near B):", await text("#status"));
  await shot("wide-arbelos");

  // Configuration 2: C near A, twenty circles and a negative chain shift.
  await setRange("#nRange", 20);
  await setRange("#tRange", -3.25);
  await dragC(145);
  log("configuration 2 (20 circles, C near A):", await text("#status"));
  await shot("small-arbelos");

  if (!first) return; // the dark run only needs the two screenshots above

  // Every option both ways, then every button in the order a player would use.
  await setRange("#tRange", 15);
  await setRange("#tRange", -15);
  await setRange("#nRange", 1);
  await setRange("#nRange", 20);
  await page.uncheck("#ellipseChk");
  log("ellipse hidden:", await page.evaluate(() =>
    document.querySelector("#board .locus").style.display));
  await page.check("#ellipseChk");
  await page.click("#resetBtn");
  log("after Reset:", await text("#status"));

  // Two keyboard-only moves; focus must stay on the handle afterwards.
  const before = await handlePos();
  await page.focus("#board .geom-handle");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowLeft");
  const after = await handlePos();
  log("keyboard moved C:", before.x !== after.x);
  log("focus stays on C:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("geom-handle")));
};
