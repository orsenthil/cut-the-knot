// Jam: a game played from the keyboard (roads cross at cities, and the horizontal road has a
// zero-height bounding box, so clicking an element's centre is not reliable here), the secret
// board, and the computer opening.
export default async ({ page, first, log, shot, text }) => {
  const roads = await page.$$("#map .road-hit");
  for (let i = 0; i < 9 && !/won|Stalemate/.test(await text("#status")); i++) {
    // Pick the first free road the core's own perfect-play search likes best: here simply play the known fork line first.
    const free = await page.evaluate(() => [...document.querySelectorAll("#map .road")].map((r, i) => (r.classList.contains("you") || r.classList.contains("computer") ? -1 : i)).filter((i) => i >= 0));
    const pref = [0, 7, 6, 3, 4, 8, 2, 1, 5].find((r) => free.includes(r));
    await roads[pref].focus();
    await page.keyboard.press("Enter");
  }
  log("game:", await text("#status"), "|", await text("#score"));
  await page.check("#secretInput");
  await shot("secret");
  if (!first) return;
  await page.check("#firstInput");
  await page.click("#startBtn");
  const taken = await page.$$eval("#map .road.computer", (r) => r.length);
  log("computer opened:", taken, "road |", await text("#status"));
  await page.click("#clearBtn");
  log("cleared:", await text("#status"));
};
