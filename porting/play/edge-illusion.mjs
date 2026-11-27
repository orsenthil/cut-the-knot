// Edge Illusion: two configurations of the Kanizsa figure, then a keyboard and
// control sweep. Run with: NODE_PATH=$(npm root -g) node porting/play.mjs edge-illusion
export default async ({ page, first, log, shot, idle, text }) => {
  const set = async (id, value) => {
    await page.evaluate(({ id, value }) => {
      const el = document.getElementById(id);
      el.value = String(value);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, { id, value });
  };
  const handle = () => page.locator('#board [aria-label^="Fill handle"]');

  await idle("#board .pac");
  log("opening:", await text("#status"));
  await shot("opening");

  // First configuration: every option at its largest value, with the seven
  // paint colours, extra corner pieces and the two colours switched.
  await page.click("#squareBtn");
  await set("nInput", 10);
  await set("partInput", 100);
  await page.click("#modePaint");
  await page.click("#extraBtn");
  await page.click("#switchBtn");
  log("largest square, paint, extra shapes, switched:", await text("#status"));
  await shot("max-config");

  // Second configuration: the opening triangle with the missing sides added.
  await page.click("#resetBtn");
  await page.click("#modeEdges");
  log("triangle with edges shown:", await text("#status"));
  await shot("edges");

  if (!first) return; // the dark run only needs the two screenshots above

  // Two arrow-key moves on the ruler dot; focus must stay on the dot.
  await handle().focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || "");
  log("focus after two arrow keys:", focused);
  log("status after keyboard:", await text("#status"));

  // Press every button in the order a player would, then sweep both sliders
  // beyond both ends. A disabled button is the applet's own scrollbar limit.
  for (const id of ["#lessN", "#lessN", "#moreN", "#moreN", "#lessPart", "#lessPart",
    "#morePart", "#morePart", "#triangleBtn", "#squareBtn", "#modePlain", "#modeEdges",
    "#modeFill", "#modePaint", "#switchBtn", "#switchBtn", "#extraBtn", "#extraBtn", "#resetBtn"]) {
    const button = page.locator(id);
    if (await button.count() && !(await button.isDisabled())) await button.click();
    log(`after ${id}:`, await text("#status"));
  }
  for (const [id, value] of [["nInput", -5], ["nInput", 10], ["nInput", 99], ["nInput", 1],
    ["partInput", -1], ["partInput", 100], ["partInput", 999], ["partInput", 0]]) {
    await set(id, value);
    log(`${id} = ${value}:`, await text("#status"));
  }

  // Finish with everything explored so the demo records a "done" play.
  await page.click("#resetBtn");
  await page.click("#modeFill");
  await page.click("#modePaint");
  await page.click("#extraBtn");
  await page.click("#switchBtn");
  log("final status class:", await page.locator("#status").getAttribute("class"));
  await shot("explored");
};
