// Solitaire in Two Colors: win a 16-card deal by taking legal pairs, show a
// refused wrong-parity click, then find and play a losing line on 6 cards, and
// make a keyboard move.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs two-color-solitaire
export default async ({ page, first, log, shot, idle, text }) => {
  const order = () =>
    page.evaluate(() => [...document.querySelectorAll("#board .cards text")].map((t) => Number(t.textContent)));

  // The gap between two neighbours of the same parity, or -1.
  const legalGap = (values) => {
    const m = values.length;
    for (let i = 0; i < m; i++) if (values[i] % 2 === values[(i + 1) % m] % 2) return i;
    return -1;
  };
  const clickGap = async (i) => page.locator(`#board .gap[data-index="${i}"]`).click();

  // A line of gap indices that ends stuck (no legal pair, cards left).
  const losingLine = (values) => {
    const removable = (v) => {
      const m = v.length;
      const out = [];
      for (let i = 0; i < m; i++) if (v[i] % 2 === v[(i + 1) % m] % 2) out.push(i);
      return out;
    };
    const remove = (v, i) => {
      const m = v.length;
      return v.filter((_, j) => j !== i && j !== (i + 1) % m);
    };
    const search = (v) => {
      const m = v.length;
      if (m === 0) return null; // a win, not what we want
      const gaps = removable(v);
      if (gaps.length === 0) return [];
      for (const i of gaps) {
        const rest = search(remove(v, i));
        if (rest) return [i].concat(rest);
      }
      return null;
    };
    return search(values);
  };

  // 16 cards: every legal line wins, so always take the first legal gap.
  let values = await order();
  let guard = 0;
  while (legalGap(values) !== -1 && guard++ < 40) {
    await clickGap(legalGap(values));
    values = await order();
  }
  log("after the win:", await text("#status"));
  log("line:", await text("#line"));
  await shot("win");

  if (!first) return; // the dark run only needs the screenshots above

  // A wrong-parity click is refused, and says which card is odd and which even.
  await page.click("#newBtn");
  const fresh = await order();
  const wrong = [...fresh.keys()].find((i) => fresh[i] % 2 !== fresh[(i + 1) % fresh.length] % 2);
  await clickGap(wrong);
  log("wrong-parity click:", await text("#status"));
  await shot("wrong-parity");

  // 6 cards: even but not a multiple of 4, so a losing line exists. Find it
  // from this deal and play it.
  await page.selectOption("#nInput", "6");
  const six = await order();
  const line = losingLine(six);
  log("6-card deal:", six.join(" "), "| losing line:", line ? line.join(",") : "none");
  for (const i of line || []) await clickGap(i);
  log("after the losing line:", await text("#status"));
  log("line:", await text("#line"));
  await shot("loss");

  // A keyboard move on a fresh deal: the ring moves from gap to gap, Enter clicks.
  await page.click("#newBtn");
  await page.focus("#board");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  log("after a keyboard click:", await text("#status"));
  await shot("keyboard");
};
