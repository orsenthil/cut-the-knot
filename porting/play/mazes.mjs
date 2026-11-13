// Mazes: build with Prim, solve; then rebuild with Kruskal.
export default async ({ page, first, log, shot, text }) => {
  await page.click('[data-tab="grid"]');
  await page.selectOption("#nxInput", "8");
  await page.selectOption("#nyInput", "6");

  await page.click('[data-tab="create"]');
  await page.click("#createBtn");
  await page.waitForFunction(
    () => /finished/i.test(document.getElementById("status").textContent),
    null,
    { timeout: 15000 },
  );
  log("prim:", await text("#status"));

  await page.click('[data-tab="solve"]');
  await page.click("#solveBtn");
  await page.waitForFunction(
    () => /Path found/i.test(document.getElementById("status").textContent),
    null,
    { timeout: 15000 },
  );
  log("solve:", await text("#status"));
  await shot("solved");

  if (!first) return;

  await page.click('[data-tab="create"]');
  await page.click('input[name=algo][value=kruskal]');
  await page.click("#createBtn");
  await page.waitForFunction(
    () => /Kruskal.*finished/i.test(document.getElementById("status").textContent),
    null,
    { timeout: 15000 },
  );
  log("kruskal:", await text("#status"));
  await shot("kruskal");
};
