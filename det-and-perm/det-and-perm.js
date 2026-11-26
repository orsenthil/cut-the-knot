"use strict";

/*
 * The page for Determinant and Permanent: drawing and input only; the
 * arithmetic is in det-and-perm-core.js. A 3 x 3 grid of digit buttons:
 * click two to swap them (Enter works too). Beside it, the six products,
 * each with its determinant sign; pointing at one lights up its three
 * cells. The goal is the largest permanent or the largest determinant.
 */

(function () {
  const Core = DetAndPermCore;
  const gridEl = document.getElementById("grid");
  const termsEl = document.getElementById("terms");
  const statusEl = document.getElementById("status");
  const totalsEl = document.getElementById("totals");

  let state = Core.start();
  let pick = null;

  const cells = [];
  for (let k = 0; k < 9; k++) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "cell"; b.dataset.k = String(k);
    gridEl.appendChild(b); cells.push(b);
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function light(cols) {
    cells.forEach((b, k) => b.classList.toggle("lit", !!cols && cols[Math.floor(k / 3)] === k % 3));
  }

  function render() {
    const g = Core.grid(state.cells);
    state.cells.forEach((v, k) => {
      const b = cells[k];
      b.textContent = String(v);
      b.classList.toggle("picked", pick === k);
      b.setAttribute("aria-label", `Row ${Math.floor(k / 3) + 1}, column ${(k % 3) + 1}: ${v}${pick === k ? ", picked" : ""}`);
    });
    termsEl.textContent = "";
    for (const t of Core.terms(g)) {
      const li = document.createElement("li");
      li.tabIndex = 0;
      const vals = t.cols.map((j, i) => g[i][j]);
      li.innerHTML = `<span class="sign ${t.sign > 0 ? "plus" : "minus"}">${t.sign > 0 ? "+" : "&minus;"}</span> ${vals.join(" &times; ")} = <b>${t.product}</b>`;
      li.setAttribute("aria-label", `${vals.join(" times ")} equals ${t.product}, ${t.sign > 0 ? "plus" : "minus"} in the determinant`);
      li.addEventListener("pointerenter", () => light(t.cols));
      li.addEventListener("pointerleave", () => light(null));
      li.addEventListener("focus", () => light(t.cols));
      li.addEventListener("blur", () => light(null));
      termsEl.appendChild(li);
    }
    const d = Core.det(g), p = Core.perm(g);
    totalsEl.innerHTML = `Permanent (add all six): <b>${p}</b> &nbsp; Determinant (use the signs): <b>${d}</b>`;
    const target = Core.GOALS[state.goal], v = Core.value(state), name = state.goal === "det" ? "determinant" : "permanent";
    if (Core.result(state) === "win") say(`A ${name} of ${v}: the largest possible with the digits 1 to 9!`, "win");
    else say(pick !== null ? `${state.cells[pick]} picked: now pick a digit to swap it with.` : `Your ${name}: ${v}. The largest possible is ${target}. Swaps so far: ${state.swaps}.`);
    if (window.Track) window.Track.state({ cells: state.cells, goal: state.goal, swaps: state.swaps });
  }

  gridEl.addEventListener("click", (e) => {
    const b = e.target.closest(".cell");
    if (!b) return;
    const k = Number(b.dataset.k);
    if (pick === null) pick = k;
    else if (pick === k) pick = null;
    else { state = Core.swap(state, pick, k) || state; pick = null; }
    render();
    cells[k].focus();
  });
  document.querySelectorAll('input[name="goal"]').forEach((r) => r.addEventListener("change", () => { state = Core.setGoal(state, r.value) || state; render(); }));
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ goal: state.goal }); pick = null; render(); });

  render();
})();
