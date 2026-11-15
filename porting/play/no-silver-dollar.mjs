// One deliberate win, one losing move, then a phone-width view of the large board.
export default async ({ page, first, log, shot, idle, text }) => {
  await page.selectOption("#chipsInput", "1");
  const chip = page.locator(".spot.chip").first();
  const label = await chip.getAttribute("aria-label");
  await chip.click();
  await page.locator(`.spot[aria-label="Space 0"]`).click();
  log("move the single counter to the left edge:", await text("#status"));
  await shot("win");
  if (!first) return;

  await page.selectOption("#chipsInput", "1");
  const second = page.locator(".spot.chip").first();
  const secondLabel = await second.getAttribute("aria-label");
  const p = Number(secondLabel.match(/at (\d+)/)[1]);
  await second.click();
  await page.locator(`.spot[aria-label="Space ${p - 1}"]`).click();
  await idle(() => /wins/i.test(document.getElementById("status").textContent));
  log("leave a single move for the computer:", await text("#status"));
  await shot("loss");

  await page.selectOption("#lengthInput", "30");
  await page.selectOption("#chipsInput", "12");
  await shot("largest");
  await page.check("#setupInput");
  await page.locator(".spot.chip").first().click();
  await page.locator('.spot[aria-label="Space 0"]').click();
  log("setup mode:", await text("#status"));
  await shot("setup");
  await page.uncheck("#setupInput");
};
