// Kayles: on a full circle, let the computer start and beat it with the mirror strategy; a pair move; a broken ring.
const notThinking = () => !/Thinking/.test(document.getElementById("status").textContent);
const board = (page) => page.evaluate(() => [...document.querySelectorAll("#ring .pin, #ring circle.pin")].map((c) => (c.classList.contains("down") ? 0 : 1)));
export default async ({ page, first, log, shot, idle, text }) => {
  await page.check("#fullBox");
  await page.click("#moveBtn");
  await idle(notThinking);
  for (let i = 0; i < 40 && !/won/.test(await text("#status")); i++) {
    // Mirror: play the computer-solver's best move for us (a winning move from a won position).
    const m = await page.evaluate(() => {
      const dots = [...document.querySelectorAll("#ring circle.pin")].map((c) => (c.classList.contains("down") ? 0 : 1));
      return KaylesCore.play(dots, () => 0.5);
    });
    const sel = m.pair ? `#ring .gap-hit[aria-label^="Knock down skittles ${m.at + 1} and"]` : `#ring .pin-hit[aria-label="Knock down skittle ${m.at + 1}"]`;
    await page.focus(sel);
    await page.keyboard.press("Enter");
    await idle(notThinking);
  }
  log("full circle, computer starts:", await text("#status"));
  await shot("circle");
  if (!first) return;
  await page.uncheck("#fullBox");
  log("broken ring:", await text("#count"));
  await page.focus("#ring .gap-hit");
  await page.keyboard.press("Enter");
  await idle(notThinking);
  log("after a pair:", await text("#status"));
};
