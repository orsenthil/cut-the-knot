"use strict";

/*
 * Browser UI for Counting And Listing All Permutations. The three generators
 * and the cycle notation are in all-permutations-core.js.
 *
 * N picks the set size; R, L and H switch between the applet's Recursive,
 * Lexicographic and Heap generators. Each row shows the permutation and its
 * cycle decomposition. Long lists are capped with an honest count.
 */

(() => {
  const C = AllPermutationsCore;
  const listEl = document.getElementById("permutations");
  const countEl = document.getElementById("count");
  const status = document.getElementById("status");
  const nLess = document.getElementById("nLess");
  const nMore = document.getElementById("nMore");
  const nOut = document.getElementById("nOut");
  const radios = [...document.querySelectorAll('input[name="algorithm"]')];

  const MAX_ROWS = 1000;
  let n = 3;
  let algorithm = "recursive";

  function render() {
    const rows = C.generate(n, algorithm);
    listEl.replaceChildren();
    const shown = Math.min(rows.length, MAX_ROWS);
    for (let i = 0; i < shown; i++) {
      const row = document.createElement("div");
      row.className = "perm";
      row.textContent = C.formatRow(rows[i], true);
      listEl.appendChild(row);
    }
    if (rows.length > shown) {
      const more = document.createElement("div");
      more.className = "perm-more";
      more.textContent = `… ${rows.length - shown} more permutations`;
      listEl.appendChild(more);
    }
    nOut.textContent = String(n);
    nLess.disabled = n <= C.MIN_N;
    nMore.disabled = n >= C.MAX_N;
    countEl.textContent = rows.length.toLocaleString();
    status.textContent = `${rows.length.toLocaleString()} permutations of ${n}, by the ${
      { recursive: "Recursive", lexicographic: "Lexicographic", heap: "Heap" }[algorithm]
    } algorithm.`;
    if (window.Track) window.Track.state({ n, algorithm, count: rows.length });
  }

  nLess.addEventListener("click", () => {
    n = Math.max(C.MIN_N, n - 1);
    render();
  });
  nMore.addEventListener("click", () => {
    n = Math.min(C.MAX_N, n + 1);
    render();
  });
  for (const radio of radios) {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        algorithm = radio.value;
        render();
      }
    });
  }

  render();
})();
