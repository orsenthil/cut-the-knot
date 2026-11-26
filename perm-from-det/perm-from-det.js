"use strict";

/*
 * The page for Permanent from a Determinant: drawing and input only; the
 * algebra is in perm-from-det-core.js. Part one: a 2 x 2 or 3 x 3 square of
 * letters; click a letter to put a minus sign on it, and the list shows
 * the sign each product gets in the determinant. Part two: Grenet's
 * matrix for the same size, and numbers to try in it.
 */

(function () {
  const Core = PermFromDetCore;
  const gridEl = document.getElementById("grid");
  const termsEl = document.getElementById("terms");
  const statusEl = document.getElementById("status");
  const gTable = document.getElementById("grenet");
  const tryEl = document.getElementById("tryOut");

  let state = Core.start({ n: 3 });
  let x = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function renderGrenet() {
    const n = state.n, G = Core.grenet(n);
    const setName = (m) => "{" + [...Array(n).keys()].filter((j) => (m >> j) & 1).map((j) => j + 1).join(",") + "}";
    gTable.innerHTML = `<tr><th></th>${G.sets.map((m) => `<th>${setName(m)}</th>`).join("")}</tr>` +
      G.M.map((row, i) => `<tr><th>${setName(G.sets[i])}</th>${row.map((v) => `<td class="${typeof v === "number" ? (v ? "one" : "") : "var"}">${Core.label(v, n)}</td>`).join("")}</tr>`).join("");
    const xs = x.slice(0, n).map((r) => r.slice(0, n));
    const d = Core.det(Core.fill(G, xs)), p = Core.perm(xs);
    tryEl.innerHTML = `With ${xs.map((r, i) => r.map((v, j) => `${Core.LETTERS[i * n + j]} = ${v}`).join(", ")).join(", ")}: the permanent is <b>${p}</b>, and the determinant of this ${G.size} &times; ${G.size} matrix is <b>${d}</b>.`;
  }

  function render() {
    const n = state.n;
    gridEl.style.gridTemplateColumns = `repeat(${n}, 3.4rem)`;
    gridEl.textContent = "";
    state.signs.forEach((sg, k) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = `cell${sg < 0 ? " neg" : ""}`; b.dataset.k = String(k);
      b.textContent = `${sg < 0 ? "−" : ""}${Core.LETTERS[k]}`;
      b.setAttribute("aria-label", `${Core.LETTERS[k]}, ${sg < 0 ? "with a minus sign" : "plus"}`);
      gridEl.appendChild(b);
    });
    termsEl.innerHTML = Core.terms(state).map((t) => `<li class="${t.sign > 0 ? "plus" : "minus"}">${t.sign > 0 ? "+" : "−"}${t.letters}</li>`).join("");
    const pos = Core.positives(state), all = n === 2 ? 2 : 6;
    if (Core.result(state) === "win") say(n === 2 ? "Both products are positive: this determinant is the permanent ad + bc!" : "5 of 6 positive: the best possible. One minus always stays, because each letter is in exactly two products.", "win");
    else say(`${pos} of ${all} products positive in the determinant.${n === 3 ? " Can you make all six positive?" : ""}`);
    renderGrenet();
    if (window.Track) window.Track.state({ n, signs: state.signs });
  }

  gridEl.addEventListener("click", (e) => {
    const b = e.target.closest(".cell");
    if (!b) return;
    const k = Number(b.dataset.k);
    state = Core.toggle(state, k) || state;
    render();
    gridEl.querySelector(`[data-k="${k}"]`).focus();
  });
  document.querySelectorAll('input[name="size"]').forEach((r) => r.addEventListener("change", () => { state = Core.start({ n: Number(r.value) }); render(); }));
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ n: state.n }); render(); });
  document.getElementById("tryBtn").addEventListener("click", () => {
    x = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => Math.floor(Math.random() * 19) - 9));
    renderGrenet();
  });

  render();
})();
