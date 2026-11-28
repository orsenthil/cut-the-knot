// Hart Inversor: two configurations of the linkage — a traced straight line,
// then a smaller divider ratio with the helper construction shown.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs hart-inversor
export default async ({ page, first, log, shot, idle, text }) => {
  const boardPoint = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);
  const handleAt = (labelPrefix) => page.evaluate((prefix) => {
    const h = [...document.querySelectorAll("circle[tabindex]")]
      .find((n) => (n.getAttribute("aria-label") || "").startsWith(prefix));
    if (!h) return null;
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  }, labelPrefix);
  const top = () => page.evaluate(() => window.scrollTo(0, 0));
  const drag = async (prefix, to) => {
    await top();
    const dot = await handleAt(prefix);
    if (!dot) throw new Error("handle not found: " + prefix);
    // The handle's bounding box centre is where the pointer must go.
    const box = await page.evaluate((prefix) => {
      const h = [...document.querySelectorAll("circle[tabindex]")]
        .find((n) => (n.getAttribute("aria-label") || "").startsWith(prefix));
      const r = h.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, prefix);
    if (!box) throw new Error("handle is not visible: " + prefix);
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    const target = await boardPoint(to.x, to.y);
    await page.mouse.move(target.x, target.y, { steps: 12 });
    await page.mouse.up();
    await idle();
  };

  const O = () => handleAt("divider O.");
  const S = () => handleAt("pivot S.");

  log("on opening:", await text("#status"));
  await page.click("#showNames");

  // Configuration 1: walk P around the dashed circle to draw Q's line.
  const s0 = await S();
  for (const a of [-0.75, -0.55, -0.35]) {
    await drag("divider P.", { x: s0.x + 37.5 * Math.cos(a), y: s0.y + 37.5 * Math.sin(a) });
  }
  log("configuration 1:", await text("#status"));
  await top();
  await shot("traced-line");
  if (!first) return; // the dark run has taken the same screenshot

  // Keyboard alone must move a handle without taking focus away from it.
  await page.locator('[aria-label^="divider O."]').focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after two arrow keys, focus is on:", focused);
  if (!focused.startsWith("divider O.")) throw new Error("keyboard focus left handle O");

  // Press every button and toggle both options in both directions.
  await page.click("#clearBtn");
  await page.click("#showExtra");
  await page.click("#showExtra");
  await page.click("#showExtra");
  await page.click("#showNames");
  await page.click("#showNames");
  log("after clearing and both checkboxes:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"));

  // Configuration 2: a smaller m makes the far arc impossible, so the page
  // reports that tracing has stopped, as the original applet does.
  const a0 = await handleAt("corner A.");
  const o0 = await O();
  await drag("divider O.", { x: a0.x + (o0.x - a0.x) * 0.35, y: a0.y + (o0.y - a0.y) * 0.35 });
  const s1 = await S(), o1 = await O();
  const dx = s1.x - o1.x, dy = s1.y - o1.y, len = Math.hypot(dx, dy) || 1;
  await drag("divider P.", { x: s1.x + (37.5 * dx) / len, y: s1.y + (37.5 * dy) / len });
  log("after the far P drag:", await text("#status"));
  await drag("corner B.", { x: (await handleAt("corner B.")).x + 12, y: (await handleAt("corner B.")).y - 9 });
  await drag("corner D.", { x: (await handleAt("corner D.")).x - 10, y: (await handleAt("corner D.")).y + 12 });
  await drag("pivot S.", { x: s1.x, y: Math.max(8, s1.y - 12) });
  await page.click("#showNames");
  await page.click("#showExtra");
  await drag("divider P.", { x: s1.x + 37.5 * Math.cos(-0.9), y: s1.y + 37.5 * Math.sin(-0.9) });
  log("configuration 2:", await text("#status"));
  await top();
  await shot("second-configuration");

  await page.click("#resetBtn");
  log("final reset:", await text("#status"));
};
