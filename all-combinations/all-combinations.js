"use strict";

/*
 * Browser UI for Counting And Listing All Combinations. The enumeration and
 * the binomial count are in all-combinations-core.js.
 *
 * Two steppers choose N (objects) and M (chosen). The list shows every way to
 * choose M of the N objects, one row per combination, written with numbers
 * 1..N. Very long lists are capped for the browser, with the true count shown.
 */

(() => {
  const C = AllCombinationsCore;
  const listEl = document.getElementById("combinations");
  const countEl = document.getElementById("count");
  const status = document.getElementById("status");
  const nLess = document.getElementById("nLess");
  const nMore = document.getElementById("nMore");
  const mLess = document.getElementById("mLess");
  const mMore = document.getElementById("mMore");
  const nOut = document.getElementById("nOut");
  const mOut = document.getElementById("mOut");

  const MAX_ROWS = 1000;
  let n = 5;
  let m = 3;

  function render() {
    let position = C.start({ n, m });
    const total = position.remaining;
    listEl.replaceChildren();
    let shown = 0;
    while (C.hasMore(position) && shown < MAX_ROWS) {
      position = C.nextState(position);
      const row = document.createElement("div");
      row.className = "combo";
      row.textContent = C.display(position.current).join("  ");
      listEl.appendChild(row);
      shown++;
    }
    if (total > BigInt(shown)) {
      const more = document.createElement("div");
      more.className = "combo-more";
      more.textContent = `… ${total - BigInt(shown)} more combinations`;
      listEl.appendChild(more);
    }

    nOut.textContent = String(n);
    mOut.textContent = String(m);
    nLess.disabled = n <= C.MIN_N;
    nMore.disabled = n >= C.MAX_N;
    mLess.disabled = m <= C.MIN_M;
    mMore.disabled = m >= Math.min(C.MAX_M, n);
    countEl.textContent = total.toLocaleString();
    status.textContent = `C(${n}, ${m}) = ${total.toLocaleString()} combinations of ${m} from ${n}.`;

    if (window.Track) window.Track.state({ n, m, count: total.toString() });
  }

  nLess.addEventListener("click", () => {
    n = Math.max(C.MIN_N, n - 1);
    m = Math.min(m, n);
    render();
  });
  nMore.addEventListener("click", () => {
    n = Math.min(C.MAX_N, n + 1);
    render();
  });
  mLess.addEventListener("click", () => {
    m = Math.max(C.MIN_M, m - 1);
    render();
  });
  mMore.addEventListener("click", () => {
    m = Math.min(n, C.MAX_M, m + 1);
    render();
  });

  render();
})();
