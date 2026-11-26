"use strict";

/*
 * The page for Ryser's Formula: drawing and input only; the formula is in
 * ryser-formula-core.js. The matrix sits on top; under it, one line per
 * set of columns: the row sums over those columns, their product and its
 * sign. Next term reveals them one at a time with a running total, which
 * lands on the permanent.
 */

(function () {
  const Core = RyserFormulaCore;
  const matEl = document.getElementById("matrix");
  const tbody = document.getElementById("terms");
  const totalEl = document.getElementById("total");
  const statusEl = document.getElementById("status");
  const sizeIn = document.getElementById("sizeIn");
  const nextBtn = document.getElementById("nextBtn");

  let state = Core.start({ n: 3, seed: 1 });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const letter = (j) => "ABCD"[j];

  function render() {
    const m = Core.matrixOf(state), n = state.n, T = Core.terms(m);
    const cur = state.shown > 0 ? T[state.shown - 1] : null;
    matEl.innerHTML = `<tr><th></th>${m[0].map((_, j) => `<th class="${cur && cur.cols.includes(j) ? "on" : ""}">${letter(j)}</th>`).join("")}</tr>` +
      m.map((row, i) => `<tr><th>row ${i + 1}</th>${row.map((v, j) => `<td class="${cur && cur.cols.includes(j) ? "on" : ""}">${v}</td>`).join("")}</tr>`).join("");
    let run = 0;
    tbody.innerHTML = T.map((t, k) => {
      const shown = k < state.shown;
      if (shown) run += t.sign * t.product;
      return `<tr class="${shown ? "" : "hidden"}${k === state.shown - 1 ? " now" : ""}"><td>{${t.cols.map(letter).join(", ")}}</td><td>${t.sums.join("·")}</td><td class="${t.sign > 0 ? "plus" : "minus"}">${t.sign > 0 ? "+" : "−"}${t.product}</td><td>${shown ? run : ""}</td></tr>`;
    }).join("");
    const p = Core.perm(m);
    totalEl.textContent = `${T.length} column sets instead of ${Core.factorial(n)} products. Multiplications: ${Core.ryserMults(n)} for Ryser, ${Core.plainMults(n)} the plain way.`;
    nextBtn.disabled = Core.next(state) === null;
    if (Core.result(state) === "done") say(`The running total ends at ${run}, and the permanent (adding all ${Core.factorial(n)} products) is ${p}.`, "done");
    else say(state.shown ? `Running total ${run}. Columns missing from a set are cancelled out by the signs.` : "Press Next term to add the column sets one at a time.");
    if (window.Track) window.Track.state({ n, seed: state.seed, shown: state.shown });
  }

  nextBtn.addEventListener("click", () => { state = Core.next(state) || state; render(); });
  document.getElementById("allBtn").addEventListener("click", () => { state = Core.all(state); render(); });
  const fresh = (seed) => { state = Core.start({ n: Number(sizeIn.value), seed }); render(); };
  sizeIn.addEventListener("change", () => fresh(1));
  document.getElementById("newBtn").addEventListener("click", () => fresh(state.seed + 1));

  render();
})();
