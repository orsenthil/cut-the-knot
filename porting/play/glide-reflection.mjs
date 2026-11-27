// Glide Reflection: two configurations — one glide with the slide shown, then
// three chained glides with a different arrow style and a dragged polygon corner.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs glide-reflection
export default async ({ page, first, log, shot, idle, text }) => {
  const client = (x, y) => page.evaluate(([px, py]) => {
    const m = document.getElementById("board").getScreenCTM();
    return { x: m.a * px + m.c * py + m.e, y: m.b * px + m.d * py + m.f };
  }, [x, y]);

  // The site header is sticky: scroll back up so it never covers a handle.
  const top = () => page.evaluate(() => window.scrollTo(0, 0));

  const drag = async (locator, to) => {
    await top();
    const dot = await locator.boundingBox();
    if (!dot) throw new Error("handle is not visible");
    await page.mouse.move(dot.x + dot.width / 2, dot.y + dot.height / 2);
    await page.mouse.down();
    const target = await client(to.x, to.y);
    await page.mouse.move(target.x, target.y, { steps: 10 });
    await page.mouse.up();
    await idle();
  };

  const headA = page.locator('[aria-label^="Arrow head A."]');
  const tailB = page.locator('[aria-label^="Arrow tail B."]');

  log("on opening:", await text("#status"));
  await page.click("#ghostBox");
  await page.click("#addBtn"); // the applet's Add button, two polygons now

  // Configuration 1: one glide, intermediate slide shown, arrow head moved.
  const before = await headA.boundingBox();
  const pos = await page.evaluate(() => {
    const h = document.querySelector('[aria-label^="Arrow head A."]');
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });
  log("arrow head A before:", JSON.stringify(pos), "box width", before.width);
  await drag(headA, { x: pos.x - 55, y: pos.y - 35 });
  log("configuration 1:", await text("#status"));
  await top();
  await shot("one-glide");
  if (!first) return; // the dark run has taken the same screenshot

  // The keyboard must move the handle without taking focus away from it.
  await headA.focus();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("after arrow keys, focus is on:", focused);
  if (!focused.startsWith("Arrow head A.")) throw new Error("keyboard focus left the arrow head");

  // Press every navigation button in the order a player would.
  await page.click("#nextGlide");
  await page.click("#prevGlide");
  await page.click("#nextShape");
  await page.click("#prevShape");
  log("after navigation:", await text("#glideLabel"), "|", await text("#shapeLabel"));

  // Every option in both directions, including both extremes.
  await page.selectOption("#glideSel", "20");
  await page.selectOption("#sidesSel", "20");
  await page.selectOption("#arrowSel", "4");
  log("at maxima:", await text("#glideLabel"), "|", await text("#status"));
  await page.selectOption("#glideSel", "1");
  await page.selectOption("#sidesSel", "3");
  await page.selectOption("#arrowSel", "0");
  log("at minima:", await text("#glideLabel"), "|", await text("#status"));
  await page.click("#dragsBox");
  await page.click("#dragsBox");
  await page.click("#ghostBox"); // hide the intermediate copies again
  await page.click("#removeBtn");
  await page.click("#addBtn");

  // Configuration 2: three chained glides, seven-sided polygons, filled arrows.
  await page.click("#ghostBox");
  await page.selectOption("#glideSel", "3");
  await page.selectOption("#sidesSel", "7");
  await page.selectOption("#arrowSel", "3");
  await page.click("#addBtn");
  await page.click("#nextGlide");
  const corner = page.locator('[aria-label^="Corner 1 of the chosen polygon."]');
  const cornerPos = await page.evaluate(() => {
    const h = document.querySelector('[aria-label^="Corner 1 of the chosen polygon."]');
    return { x: Number(h.getAttribute("cx")), y: Number(h.getAttribute("cy")) };
  });
  await drag(corner, { x: cornerPos.x - 60, y: cornerPos.y + 25 });
  log("configuration 2:", await text("#status"));
  log("tail B:", JSON.stringify(await tailB.boundingBox()));
  await top();
  await shot("three-glides");

  await page.click("#resetBtn");
  log("after reset:", await text("#status"));
};
