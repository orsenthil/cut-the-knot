// Equichordal: a drawing, not a game. Show two different configurations of
// the sine curve and its fixed-length chord, then exercise every control.
// Run with: export NODE_PATH=$(npm root -g); node porting/play.mjs equichordal
export default async ({ page, first, log, shot, text }) => {
  const setRange = (id, value) => page.$eval(
    "#" + id,
    (el, v) => { el.value = String(v); el.dispatchEvent(new Event("input", { bubbles: true })); },
    value,
  );
  const handleAt = (sel) => page.evaluate((s) => {
    const h = document.querySelector(s);
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, sel);
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);
  const drag = async (sel, x, y) => {
    const from = await handleAt(sel);
    const start = await client(from.x, from.y);
    const end = await client(x, y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 16 });
    await page.mouse.up();
  };

  log("initial:", await text("#status"));
  await shot("start");

  // Configuration 1: a three-lobed sine curve, with A dragged off the curve.
  await page.check("#formulaChk");
  await setRange("powerRange", 3);
  await setRange("shiftRange", 2);
  await setRange("freqRange", 3);
  await page.click("#clearBtn");
  await drag("#board .eq-handle-a", 430, 130);
  log("configuration 1 (Power 3, Shift 2, Frequency 3):", await text("#status"));
  await shot("three-lobed-chord");

  if (!first) return; // the dark run only needs the screenshots above

  // Two keyboard-only moves; focus must stay on the handle after each one.
  const before = await handleAt("#board .eq-handle-a");
  await page.focus("#board .eq-handle-a");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Shift+ArrowDown");
  const after = await handleAt("#board .eq-handle-a");
  log("keyboard moved A:", before.x !== after.x || before.y !== after.y);
  log("focus stayed on A:", await page.evaluate(
    () => !!document.activeElement && document.activeElement.classList.contains("eq-handle-a")));
  await shot("keyboard");

  // Configuration 2: every slider at its maximum, the curve drawn, B dragged.
  await setRange("powerRange", 61);
  await setRange("shiftRange", 11);
  await setRange("freqRange", 81);
  await page.click("#clearBtn");
  await drag("#board .eq-handle-b", 250, 100);
  log("configuration 2 (all maxima):", await text("#status"));
  await shot("max-curve-chord");

  // Every button and option in both directions, including out-of-range fills.
  await page.uncheck("#formulaChk");
  log("curve hidden:", await text("#status"));
  await page.check("#formulaChk");
  await setRange("powerRange", 1);
  await setRange("shiftRange", 1);
  await setRange("freqRange", 1);
  log("all minima:", await text("#status"));
  await setRange("powerRange", 999);
  await setRange("shiftRange", 999);
  await setRange("freqRange", 999);
  log("above maxima (clamped):", await text("#status"));
  await setRange("powerRange", -5);
  await setRange("shiftRange", -5);
  await setRange("freqRange", -5);
  log("below minima (clamped):", await text("#status"));
  await page.click("#clearBtn");
  log("after Clear:", await text("#status"));
  await shot("reset");
};
