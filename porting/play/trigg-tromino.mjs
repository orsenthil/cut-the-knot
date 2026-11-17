// Trigg Tromino: click in a fault-free covering, then one with three faults; Blocks; keyboard.
const pick = async (page, r, c) => {
  await page.evaluate(([row, col]) => {
    const rows = [...document.querySelectorAll("#board g[role=row]")];
    const cell = [...rows[row].querySelectorAll("rect")].find((el) => {
      const cIdx = Math.round((Number(el.getAttribute("x")) - 2) / 40);
      return cIdx === col && !el.classList.contains("hole");
    });
    if (cell) cell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  }, [r, c]);
};

const enterTiling = async (page, pieces) => {
  const touch = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
  for (const p of pieces) {
    const corner = p.find((a) => p.filter((b) => b !== a && touch(a, b)).length === 2);
    const ends = p.filter((a) => a !== corner);
    for (const [r, c] of [ends[0], corner, ends[1]]) await pick(page, r, c);
  }
};

export default async ({ page, first, log, shot, text }) => {
  const zero = await page.evaluate(() => TriggTrominoCore.findCovering(0));
  await enterTiling(page, zero);
  log("fault-free:", await text("#status"));
  await shot("win");
  if (!first) return;

  await page.check('input[name="view"][value="blocks"]');
  await shot("blocks");
  await page.click("#undoBtn");
  log("after Remove last:", JSON.stringify(await text("#status")));

  await page.click("#resetBtn");
  const three = await page.evaluate(() => TriggTrominoCore.findCovering(3));
  await enterTiling(page, three);
  log("three faults:", await text("#status"));
  await shot("three");

  await page.click("#resetBtn");
  await page.locator("#board rect.sq:not(.hole)").first().focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log(
    "keyboard two clicks, picked:",
    await page.locator("#board rect.sq.picked").count()
  );
};
