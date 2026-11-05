// Ducci: four random numbers die out; five fall into a loop; edit and undo.
const step = async (page, times) => { for (let i = 0; i < times; i++) await page.click("#stepBtn"); };
export default async ({ page, first, log, shot, text }) => {
  for (let i = 0; i < 40 && !/All zeros/.test(await text("#status")); i++) await step(page, 1);
  log("4 random numbers:", await text("#status"));
  await shot("zeros");
  if (!first) return;
  await page.selectOption("#nInput", "5");
  for (let i = 0; i < 80 && !/loop/.test(await text("#status")); i++) await step(page, 1);
  log("5 random numbers:", await text("#status"));
  await shot("loop");
  const before = await page.$$eval("#circle .num text", (t) => t.map((x) => x.textContent).filter((s) => /\d/.test(s)).join(" "));
  await page.locator("#circle .num").first().focus();
  await page.keyboard.press("ArrowUp");
  const after = await page.$$eval("#circle .num text", (t) => t.map((x) => x.textContent).filter((s) => /\d/.test(s)).join(" "));
  await page.click("#undoBtn");
  const undone = await page.$$eval("#circle .num text", (t) => t.map((x) => x.textContent).filter((s) => /\d/.test(s)).join(" "));
  log("edit then undo:", before, "->", after, "->", undone, undone === before ? "(restored)" : "(NOT restored)");
  await page.selectOption("#nInput", "20");
  await step(page, 3);
  log("20 numbers:", await text("#stepLine"));
};
