// Peaucellier-Lipkin Linkage: a traced straight line, then a different set
// of rod lengths with the circle centre moved.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs invert
export default async ({ page, first, log, shot, idle, text }) => {
  const handleAt = (prefix) => page.evaluate((p) => {
    const h = [...document.querySelectorAll("circle[tabindex]")]
      .find((n) => (n.getAttribute("aria-label") || "").startsWith(p));
    if (!h) return null;
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, prefix);
  const clientBox = (prefix) => page.evaluate((p) => {
    const h = [...document.querySelectorAll("circle[tabindex]")]
      .find((n) => (n.getAttribute("aria-label") || "").startsWith(p));
    if (!h) return null;
    const r = h.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, prefix);
  const boardPoint = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);
  const top = () => page.evaluate(() => window.scrollTo(0, 0));
  const drag = async (prefix, to) => {
    await top();
    const box = await clientBox(prefix);
    if (!box) throw new Error("handle not visible: " + prefix);
    const start = await handleAt(prefix);
    const target = await boardPoint(to.x, to.y);
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();
    await idle();
    const end = await handleAt(prefix);
    log("  dragged " + prefix + " from (" + Math.round(start.x) + "," + Math.round(start.y) +
      ") to (" + Math.round(end.x) + "," + Math.round(end.y) + ")");
  };

  const A = "circle point A.", P = "circle centre P.", B = "corner B.",
    O = "pivot O.", C = "drawing point C.";

  log("on opening:", await text("#status"));

  // Configuration 1: walk A along the dashed circle so C draws its line.
  const centre = await handleAt(P);
  for (const ang of [-0.9, -0.65, -0.4, -0.15]) {
    await drag(A, { x: centre.x + 60 * Math.cos(ang), y: centre.y + 60 * Math.sin(ang) });
  }
  log("configuration 1:", await text("#status"));
  await top();
  await shot("straight-line");

  if (first) {
    // Two arrow keys alone must move a ring without stealing focus.
    await page.locator('[aria-label^="' + O + '"]').focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowUp");
    const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
    log("after two arrow keys, focus is on:", focused);
    if (!focused.startsWith(O)) throw new Error("keyboard focus left handle O");

    // Press every button and toggle both boxes in both directions.
    await page.click("#clearBtn");
    await page.click("#showGuides");
    await page.click("#showGuides");
    await page.click("#showNames");
    await page.click("#showNames");
    log("after Clear line and both boxes:", await text("#status"));
    await page.click("#resetBtn");
    log("after Reset:", await text("#status"));
  }

  // Configuration 2: new rod lengths, a moved circle centre and a new arc.
  await drag(B, { x: 235, y: 175 });
  await drag(C, { x: 220, y: 220 });
  await drag(P, { x: 210, y: 250 });
  const c2 = await handleAt(P);
  await drag(A, { x: c2.x + 60 * Math.cos(-0.5), y: c2.y + 60 * Math.sin(-0.5) });
  log("configuration 2:", await text("#status"));
  await top();
  await shot("second-configuration");

  await page.click("#resetBtn");
  log("final reset:", await text("#status"));
};
