// Dijkstra: two configurations of the draggable triangle, with every button
// pressed in both directions and a keyboard-only move checked. This is a
// demo, so there is no win or loss to play through.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs dijkstra
export default async ({ page, first, log, shot, text }) => {
  const board = page.locator("#board");
  const box = await board.boundingBox();
  const toClient = (x, y) => ({
    x: box.x + (x / 500) * box.width,
    y: box.y + (y / 450) * box.height,
  });
  const drag = async (from, to) => {
    const a = toClient(from[0], from[1]);
    const b = toClient(to[0], to[1]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 12 });
    await page.mouse.up();
  };
  const pressed = () => page.evaluate(() =>
    ["areas", "color", "hint", "names"]
      .map((id) => id + "=" + document.getElementById(id + "Btn").getAttribute("aria-pressed"))
      .join(" "));
  const colorDisabled = () => page.evaluate(() => document.getElementById("colorBtn").disabled);

  log("initial:", await text("#status"), "|", await pressed(), "| color disabled:", await colorDisabled());
  await shot("start");

  // Configuration 1: drag into a long, flat triangle with an obtuse angle at C,
  // then turn on every option the applet's panel offers.
  await drag([62.5, 285], [40, 340]);
  await drag([437.5, 285], [470, 330]);
  await drag([281.25, 140.87], [245, 60]);
  for (const id of ["areas", "color", "hint", "names"]) await page.click("#" + id + "Btn");
  log("config1:", await text("#status"), "|", await pressed(), "| color disabled:", await colorDisabled());
  await shot("config1");

  // Keyboard-only move: the focused handle must stay focused after a redraw.
  await page.locator('#board circle[role="button"]').nth(2).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowUp");
  const focus = await page.evaluate(() => ({
    role: document.activeElement?.getAttribute("role"),
    label: document.activeElement?.getAttribute("aria-label")?.slice(0, 32),
  }));
  if (first) log("keyboard:", JSON.stringify(focus), "|", await text("#status"));

  // Configuration 2: an exact right angle, reached with the shape button.
  await page.click('[data-shape="right"]');
  log("config2:", await text("#status"), "|", await pressed());
  await shot("config2");

  // Press every toggle the other way, in the order the panel allows it.
  await page.click("#colorBtn");
  await page.click("#hintBtn");
  await page.click("#namesBtn");
  await page.click("#areasBtn");
  log("after toggles off:", await text("#status"), "|", await pressed(), "| color disabled:", await colorDisabled());
  // Color cannot be pressed while Areas is off; the button itself says so.
  await page.click('[data-shape="acute"]');
  log("overlap:", await text("#status"));
  await page.click("#resetBtn");
  log("after reset:", await text("#status"), "|", await pressed());
  await shot("reset");
};
