"use strict";

/*
 * The page for Determinant by Elimination: drawing and input only; the
 * exact arithmetic is in determinant-elimination-core.js. A table shows
 * the matrix at the current stage, the rows just used highlighted. Beside
 * it: the determinant (never changes, except for sign on a swap), the
 * permanent of the matrix as it now stands (it does change), and the
 * multiplications used so far against the n! way.
 */

(function () {
  const Core = DeterminantEliminationCore;
  const table = document.getElementById("matrix");
  const factsEl = document.getElementById("facts");
  const statusEl = document.getElementById("status");
  const sizeIn = document.getElementById("sizeIn");
  const stepBtn = document.getElementById("stepBtn");

  let state = Core.start({ n: 4, seed: 1 });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const st = Core.stages(state), cur = st[state.step], first = st[0];
    table.textContent = "";
    cur.m.forEach((row, i) => {
      const tr = document.createElement("tr");
      if (cur.rows && cur.rows[0] === i) tr.className = "changed";
      else if (cur.rows && cur.rows[1] === i) tr.className = "source";
      row.forEach((v, j) => {
        const td = document.createElement("td");
        td.textContent = v;
        if (j < i && v === "0") td.classList.add("zero");
        if (cur.pivot === j && i === j) td.classList.add("pivot");
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    const ex = Core.expand(cur.m), ex0 = Core.expand(first.m);
    factsEl.innerHTML = `
      <li>Step ${state.step} of ${st.length - 1}: <b>${cur.what}</b></li>
      <li>Determinant of the matrix now: <b>${ex.det}</b> ${cur.sign < 0 ? "(the start's, with the sign flipped by a swap)" : "(the same as at the start)"}</li>
      <li>Permanent of the matrix now: <b>${ex.perm}</b> (at the start: ${ex0.perm})</li>
      <li>Multiplications and divisions so far: <b>${cur.ops}</b>. Adding up all ${Core.factorial(state.n)} products would take ${Core.expansionOps(state.n)}.</li>`;
    stepBtn.disabled = Core.next(state) === null;
    if (cur.done) say(`Done: the determinant is ${cur.det}, the product of the diagonal${cur.sign < 0 ? " with a minus sign for the swap" : ""}, after ${cur.ops} multiplications and divisions.`, "done");
    else if (cur.zero) say(`A column with no pivot: the determinant is 0.`, "done");
    else say(state.step ? "Each row operation keeps the determinant. Watch what happens to the permanent." : "Press Step to make zeros below the diagonal, one row at a time.");
    if (window.Track) window.Track.state({ n: state.n, seed: state.seed, step: state.step });
  }

  stepBtn.addEventListener("click", () => { state = Core.next(state) || state; render(); });
  document.getElementById("endBtn").addEventListener("click", () => { state = Core.finish(state); render(); });
  const fresh = (seed) => { state = Core.start({ n: Number(sizeIn.value), seed }); render(); };
  sizeIn.addEventListener("change", () => fresh(1));
  document.getElementById("newBtn").addEventListener("click", () => fresh(state.seed + 1));

  render();
})();
