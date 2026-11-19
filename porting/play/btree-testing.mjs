// Factor Tree: look at the first screen, try both ends of the factor-count
// option, make two keyboard-only moves, press every button, then factor a
// whole number so the demo is marked explored.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs btree-testing
import { loadCore } from "../lib/load-core.mjs";

const C = loadCore("btree-testing/btree-testing-core.js", "BTreeTestingCore");

function smallestFactor(x) {
  for (let d = 2; d <= x; d++) if (x % d === 0) return d;
  return x;
}

/** The number is announced in the status line after New problem / Repeat. */
function readNumber(line) {
  const m = line.match(/factor (\d+)/) || line.match(/number, (\d+)/);
  return m ? Number(m[1]) : null;
}

export default async ({ page, first, log, shot, text }) => {
  // A shadow of the board's position, so the scenario always picks a factor
  // that the real page will accept.
  let pos = null;
  let selPath = "L";

  const focus = () => page.evaluate(() => document.activeElement && document.activeElement.id);

  async function setOption(count) {
    await page.selectOption("#countSelect", count);
    const line = await text("#status");
    const n = readNumber(line);
    if (!n) throw new Error("no number announced in: " + line);
    pos = { n: n, count: Number(count), root: C.makeRoot(n) };
    selPath = "L";
    return line;
  }

  /** Enter a factor, either from the canvas keyboard or through the field. */
  async function split(d, viaKeyboard) {
    const out = C.enterFactor(pos, selPath, d);
    if (!out.ok) throw new Error("test picked a bad factor " + d + ": " + out.message);
    pos = out.position;
    const empties = C.emptyPaths(pos.root);
    if (empties.indexOf(selPath) === -1) selPath = empties.length ? empties[0] : "";
    if (viaKeyboard) {
      await page.keyboard.type(String(d));
      await page.keyboard.press("Enter");
    } else {
      await page.fill("#factorInput", String(d));
      await page.click("#checkBtn");
    }
    return await text("#status");
  }

  log("initial:", await text("#status"));
  await shot("initial");

  // Every option at its maximum: six prime factors makes the tallest tree.
  log("option at maximum:", await setOption("6"));
  await shot("max");

  // The other extreme: two factors, a short tree.
  log("option at minimum:", await setOption("2"));
  await shot("min");
  await setOption("6");

  // Two moves with the keyboard alone. ArrowRight picks the right box, then
  // digits and Enter split it; the highlighted box moves back to the left.
  const parentValue = () => C.nodeAt(pos.root, selPath.slice(0, -1)).value;
  await page.focus("#treeCanvas");
  await page.keyboard.press("ArrowRight");
  selPath = "R"; // the board's highlight moved to the right box
  log("after first keyboard split:", await split(smallestFactor(parentValue()), true));
  log("focus after first keyboard move:", await focus());
  if (first && (await focus()) !== "treeCanvas") throw new Error("focus left the board after move 1");
  log("after second keyboard split:", await split(smallestFactor(parentValue()), true));
  log("focus after second keyboard move:", await focus());
  if (first && (await focus()) !== "treeCanvas") throw new Error("focus left the board after move 2");
  await shot("keyboard");

  // Press every button in the order a player would: a fresh problem, repeat
  // the same number with empty boxes, then enter a factor with the button.
  await page.click("#newBtn");
  const line = await text("#status");
  const n = readNumber(line);
  if (!n) throw new Error("New problem did not announce a number: " + line);
  pos = { n: n, count: 6, root: C.makeRoot(n) };
  selPath = "L";
  log("after New problem:", line);

  await page.click("#repeatBtn");
  log("after Repeat problem:", await text("#status"));
  log("after Enter factor:", await split(smallestFactor(pos.n), false));
  await shot("buttons");

  // Finish the tree. Every split keeps the product, so the leaves are the
  // prime factorization and the page marks the demo as explored.
  let guard = 0;
  while (!C.isComplete(pos.root)) {
    const path = selPath || C.emptyPaths(pos.root)[0];
    const parent = C.nodeAt(pos.root, path.slice(0, -1));
    const line = await split(smallestFactor(parent.value), false);
    if (guard++ > 40) throw new Error("the tree did not finish: " + line);
  }
  const doneLine = await text("#status");
  const doneClass = await page.$eval("#status", (el) => el.classList.contains("done"));
  log("final:", doneLine, "| done class:", doneClass);
  if (first && !doneClass) throw new Error("the finished tree was not marked done");
  await shot("done");
};
