// The game of Fif: play until the end (any result), try the computer-first box, the magic square view and Clear.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs fif
export default async ({ page, first, log, shot, text }) => {
  const kind = () => page.evaluate(() => ["win", "lose", "done"].find((k) => document.getElementById("status").classList.contains(k)) || "");
  const free = () => page.evaluate(() => [...document.querySelectorAll("#board button.sq:not(:disabled)")].map((b) => Number(b.dataset.n)));
  const focus = () => page.evaluate(() => document.activeElement && (document.activeElement.dataset.n || document.activeElement.id));
  const playOut = async (prefer) => {
    for (let k = 0; k < 12; k++) {
      if (await kind()) return;
      const f = await free(); if (!f.length) return;
      const n = prefer.find((p) => f.includes(p)) || f[0];
      await page.click(`#board button[data-n="${n}"]`);
    }
  };
  log("initial:", await text("#status"), "|", await text("#score"));
  await shot("initial");
  await page.check("#magicBox"); await page.check("#firstBox");
  log("magic square view, computer first:", await text("#status"), "| start enabled =", await page.locator("#startBtn").isEnabled(), "| squares enabled =", (await free()).length);
  await shot("max-options");
  await page.click("#startBtn");
  log("after Start:", await text("#holds"));
  await page.uncheck("#firstBox"); await page.uncheck("#magicBox");
  await playOut([5, 4, 6, 2, 8, 1, 3, 7, 9]);
  log("a game:", await text("#status"), "| result =", await kind(), "|", await text("#score"));
  await shot("win");
  await page.mouse.move(1, 1); await page.waitForTimeout(800); // a Wikipedia hover card under the pointer would stick out of the phone screen
  if (!first) return;
  await page.click('#board button[data-n="5"]');
  log("a click after the end starts again:", await text("#holds"), "| result =", await kind());
  await page.click("#clearBtn");
  log("Clear:", await text("#status"), "|", await text("#score"));
  // keyboard: digit keys take squares
  await page.locator('#board button[data-n="1"]').focus();
  await page.keyboard.press("5"); await page.keyboard.press("ArrowRight");
  log("keyboard 5 then arrow: focus =", await focus(), "|", await text("#holds"));
  await playOut([9, 1, 3, 7, 2, 4, 6, 8]);
  log("another game:", await text("#status"), "| result =", await kind());
  await shot("loss");
  await page.click("#clearBtn");
  await page.mouse.move(1, 1); await page.waitForTimeout(800);
};
