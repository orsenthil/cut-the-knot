// Color Graph: a demo, so "explored" is a proper colouring, and a dead end is
// two neighbours sharing a colour. Play with the keyboard, press every button,
// set every option to its largest value, then colour Graph 2 with its minimum
// three colours and spoil it. Run with:
//   NODE_PATH=$(npm root -g) node porting/play.mjs color-graph
export default async ({ page, first, log, shot, text }) => {
  const focus = () => page.evaluate(() => (document.activeElement && document.activeElement.id) || "none");
  const statusClass = () => page.locator("#status").getAttribute("class");

  // Node positions of Graph 2, from the applet's own <param> tags. The page
  // maps relative (x, y) into the canvas with a 16px padding on each side.
  const nodes = {
    A: [0.35, 0.2], B: [0.65, 0.2], F: [0.2, 0.5], G: [0.5, 0.5],
    C: [0.8, 0.5], E: [0.35, 0.8], D: [0.65, 0.8],
  };
  const clickNode = async (label) => {
    // The palette sits below the board, so clicking a swatch scrolls the page.
    // Bring the board back into view and keep it clear of the sticky header.
    const canvas = page.locator("#graphCanvas");
    await canvas.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const r = document.getElementById("graphCanvas").getBoundingClientRect();
      const header = document.querySelector(".site-header");
      const top = header ? header.getBoundingClientRect().bottom : 0;
      if (r.top < top + 8) window.scrollBy(0, r.top - top - 8);
    });
    const box = await canvas.boundingBox();
    const [x, y] = nodes[label];
    await page.mouse.click(box.x + 16 + x * (box.width - 32), box.y + 16 + y * (box.height - 32));
  };
  const paint = async (color, label) => {
    await page.click("#color" + color);
    await clickNode(label);
  };

  log("initial:", await text("#status"), "|", await text("#graphInfo"));
  await shot("initial");

  // Every option at its largest value: the last sample graph, colour 10, the
  // Define tab, and its last tool (drag).
  await page.click("#graph5");
  await page.click("#color9");
  await page.click("#defineModeBtn");
  await page.click("#toolDragBtn");
  log("all options at maximum:", await text("#status"), "|", await text("#graphInfo"));
  await shot("max-options");

  // Back to colouring. Two keyboard moves, then focus must still be on the
  // board: the arrow key chooses a node and Enter colours it.
  await page.click("#colorModeBtn");
  await page.focus("#graphCanvas");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log("two keyboard moves:", await text("#status"), "| focus:", await focus());
  if ((await focus()) !== "graphCanvas") throw new Error("keyboard moves took focus off the board");
  await shot("keyboard");

  if (!first) return; // the dark run only needs the screenshots above

  // Press every button in the order a player would, and move every option in
  // both directions (first and last graph, first and last palette colour).
  for (let i = 0; i < 6; i++) await page.click("#graph" + i);
  log("graph buttons:", await text("#graphInfo"));
  await page.click("#newBtn");
  log("after New graph:", await text("#status"), "|", await text("#graphInfo"));
  await page.click("#colorModeBtn");
  await page.click("#defineModeBtn");
  for (const id of ["#toolAddNodeBtn", "#toolAddEdgeBtn", "#toolDeleteNodeBtn", "#toolDeleteEdgeBtn", "#toolDragBtn"]) {
    await page.click(id);
  }
  log("after every tool:", await text("#status"));
  await page.click("#color0");
  await page.click("#color9");
  log("palette extremes:", await text("#status"));
  await page.click("#resetBtn");
  log("after Clear colours:", await text("#status"));
  await shot("buttons");

  // A dead end: Graph 2's A and B are neighbours, and both get colour 1.
  await page.click("#graph1"); // selects the graph and returns to the Colour tab
  await page.click("#resetBtn");
  await paint(0, "A");
  await paint(0, "B");
  log("after a conflict:", await text("#status"), "| class:", await statusClass());
  await shot("dead-end");

  // The win: a proper 3-colouring of the wheel — the six outer nodes
  // alternate between two colours and the hub takes a third.
  await page.click("#resetBtn");
  await paint(0, "A");
  await paint(1, "B");
  await paint(0, "C");
  await paint(1, "D");
  await paint(0, "E");
  await paint(1, "F");
  await paint(2, "G");
  log("after a proper colouring:", await text("#status"), "| class:", await statusClass());
  log("final readout:", await text("#graphInfo"));
  if (!(await statusClass()).includes("done")) throw new Error("a proper colouring did not finish the play");
  await shot("proper-colouring");
};
