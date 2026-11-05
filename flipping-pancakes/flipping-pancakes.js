"use strict";

/*
 * UI for Flipping Pancakes. The move rule, the scrambler and the page's
 * strategy live in pancakes-core.js; this file draws the stack and handles
 * clicks.
 *
 * The applet's panel is kept: < and > for the number of pancakes (3..40,
 * starting at 5), < and > for how far a flip reaches ("top", or a fixed
 * width), the Scarce checkbox and Reset, with a running count of flips and
 * the applet's own end-of-game wording from its m_Results array. The one
 * addition is that hovering a pancake lights up the run that would turn over,
 * which matters once the flip no longer reaches the top.
 *
 * The applet counts a flip of the topmost pancake alone, which changes
 * nothing; here that click is refused and says why, since it is exactly the
 * move the cut-the-knot page points out is missing from the move set.
 */
(() => {
  const C = PancakeCore;

  const stackEl = document.getElementById("stack");
  const statusEl = document.getElementById("status");
  const countLine = document.getElementById("countLine");
  const sizeLabel = document.getElementById("sizeLabel");
  const spanLabel = document.getElementById("spanLabel");
  const fewerBtn = document.getElementById("fewerBtn");
  const moreBtn = document.getElementById("moreBtn");
  const spanLessBtn = document.getElementById("spanLessBtn");
  const spanMoreBtn = document.getElementById("spanMoreBtn");
  const scarceInput = document.getElementById("scarceInput");
  const resetBtn = document.getElementById("resetBtn");

  let n = C.N_DEFAULT;
  let span = C.SPAN_ALL; // 0 = all the way to the top, else how many pancakes
  let stack = [];
  let scrambleFlips = 0;
  let flips = 0;
  let carried = 0; // the applet's m_Num, which Reset() only clears after Shuffle()
  let message = "";
  let hover = null;
  let cakes = [];

  /* ---------------------------------------------------------------- render */

  const plural = (k) => (k === 1 ? "flip" : "flips");

  /** Pancake value 0 is the biggest, so width falls as the value rises. */
  const widthOf = (value) => `${(96 - (62 * value) / Math.max(1, n - 1)).toFixed(2)}%`;

  function build() {
    stackEl.textContent = "";
    cakes = [];
    stackEl.style.setProperty("--ch", `${Math.min(26, Math.max(5, Math.round(180 / n)))}px`);
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cake";
      b.addEventListener("click", () => play(i));
      b.addEventListener("mouseenter", () => { hover = i; paintHover(); });
      b.addEventListener("focus", () => { hover = i; paintHover(); });
      b.addEventListener("mouseleave", () => { hover = null; paintHover(); });
      b.addEventListener("blur", () => { hover = null; paintHover(); });
      stackEl.appendChild(b);
      cakes.push(b);
    }
  }

  /** Light up the run a click would turn over. */
  function paintHover() {
    const [lo, hi] = hover === null ? [-1, -2] : C.range(n, hover, span);
    for (let i = 0; i < n; i++) cakes[i].classList.toggle("willflip", i >= lo && i <= hi);
  }

  function render(justFlipped = [-1, -2]) {
    for (let i = 0; i < n; i++) {
      const b = cakes[i];
      b.style.width = widthOf(stack[i]);
      b.classList.toggle("just", i >= justFlipped[0] && i <= justFlipped[1]);
      b.setAttribute("aria-label",
        `Position ${i + 1} from the bottom, pancake size ${n - stack[i]} of ${n}` +
        (C.isNoop(n, i, span) ? "" : ": flip from here"));
    }
    paintHover();

    const done = C.isSorted(stack);
    if (done && !message) message = winText();
    statusEl.textContent = message;
    statusEl.classList.toggle("win", done);
    countLine.innerHTML = done
      ? `Scrambled with <strong>${scrambleFlips}</strong> ${plural(scrambleFlips)}.`
      : `So far it's: <strong>${flips}</strong> ${plural(flips)}.`;

    sizeLabel.textContent = String(n);
    spanLabel.textContent = span === C.SPAN_ALL ? "the top" : `${span} cakes`;
    fewerBtn.disabled = n <= C.N_MIN;
    moreBtn.disabled = n >= C.N_MAX;
    spanLessBtn.disabled = span === C.SPAN_ALL;
    spanMoreBtn.disabled = span >= n;
  }

  /** The applet's m_Results wording, from CheckFinished(). */
  function winText() {
    if (flips <= scrambleFlips) {
      return `To scramble it took ${scrambleFlips} ${plural(scrambleFlips)}, ` +
        `to solve it took ${flips} ${plural(flips)}.`;
    }
    return `You did it in ${flips} ${plural(flips)}.`;
  }

  /* ------------------------------------------------------------------- play */

  function play(i) {
    if (C.isSorted(stack)) return;
    if (C.isNoop(n, i, span)) {
      message = "Turning over just the top pancake changes nothing — that move is not in the set.";
      render();
      return;
    }
    const range = C.range(n, i, span);
    stack = C.flip(stack, i, span, scarceInput.checked);
    flips++;
    carried++;
    message = "";
    render(range);
  }

  /* --------------------------------------------------------------- controls */

  function deal() {
    const dealt = C.scramble(n, span, scarceInput.checked, carried);
    stack = dealt.stack;
    scrambleFlips = dealt.scrambleFlips;
    carried = 0; // Reset(): m_Num is cleared once the shuffling is done
    flips = 0;
    message = "";
    hover = null;
    render();
  }

  function resize(delta) {
    const next = Math.min(C.N_MAX, Math.max(C.N_MIN, n + delta));
    if (next === n) return;
    n = next;
    if (span !== C.SPAN_ALL) span = Math.min(span, n);
    build();
    deal();
  }

  function respan(delta) {
    // The order is: all the way to the top, then 2, 3, ... n pancakes.
    const steps = [C.SPAN_ALL];
    for (let k = 2; k <= n; k++) steps.push(k);
    const at = steps.indexOf(span);
    const next = steps[Math.min(steps.length - 1, Math.max(0, at + delta))];
    if (next === span) return;
    span = next;
    deal();
  }

  resetBtn.addEventListener("click", deal);
  fewerBtn.addEventListener("click", () => resize(-1));
  moreBtn.addEventListener("click", () => resize(+1));
  spanLessBtn.addEventListener("click", () => respan(-1));
  spanMoreBtn.addEventListener("click", () => respan(+1));
  scarceInput.addEventListener("change", deal);

  build();
  deal();
})();
