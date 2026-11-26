// WGraphs: mark a round trip with Cheapest Link, then grow the lightest tree with Kruskal.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs wgraphs
export default async ({ page, first, log, shot, text }) => {
  const edge = (id) => `[data-edge="${id}"]`;
  const clickEdge = (id) => page.click(edge(id));

  // Two moves with the keyboard alone; focus must stay on the board.
  await page.focus(edge(2));
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log("after two keyboard moves:", await text("#count"), "| focus on edge:",
    await page.evaluate(() => (document.activeElement && document.activeElement.dataset.edge) || "none"));

  for (const id of [5, 1, 10, 3, 7]) await clickEdge(id);
  log("cheapest link:", await text("#status"), "|", await text("#count"));
  await shot("cheapest-link");
  if (!first) return; // the dark run only needs the screenshot above

  await page.click("#kruskalBtn");
  for (const id of [2, 4, 5, 1, 10]) await clickEdge(id);
  log("kruskal:", await text("#status"), "|", await text("#count"));
  await shot("kruskal");

  await page.click("#cheapestBtn");
  await page.selectOption("#graphIn", "large");
  log("large example:", await text("#count"));
  await shot("large");
};
