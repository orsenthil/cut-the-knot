"use strict";

/*
 * The page for The Multiplication Table: drawing and input only. A 20 by 20
 * table of buttons with sticky headers; pressing an entry lights its row and
 * column and every place the same product appears. The rules are in
 * multiplication-table-core.js.
 */

(function () {
  const Core = MultiplicationCore;
  const tbl = document.getElementById("tbl");
  const statusEl = document.getElementById("status");
  const cells = [];
  const colHeads = [], rowHeads = [];

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function build() {
    const head = tbl.createTHead().insertRow();
    const corner = document.createElement("th"); corner.textContent = "×"; head.appendChild(corner);
    for (let b = 1; b <= Core.N; b++) { const th = document.createElement("th"); th.textContent = b; th.setAttribute("scope", "col"); head.appendChild(th); colHeads.push(th); }
    const body = tbl.createTBody();
    for (let a = 1; a <= Core.N; a++) {
      const tr = body.insertRow();
      const th = document.createElement("th"); th.textContent = a; th.setAttribute("scope", "row"); tr.appendChild(th); rowHeads.push(th);
      cells[a - 1] = [];
      for (let b = 1; b <= Core.N; b++) {
        const td = tr.insertCell(), btn = document.createElement("button");
        if (a === b) td.className = "diag";
        btn.type = "button"; btn.textContent = Core.product(a, b);
        btn.setAttribute("aria-label", `${a} times ${b} is ${a * b}`);
        btn.dataset.a = a; btn.dataset.b = b;
        btn.addEventListener("click", () => { state = Core.pick(state, a, b); render(); });
        td.appendChild(btn); cells[a - 1][b - 1] = btn;
      }
    }
    tbl.addEventListener("keydown", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const a = Number(b.dataset.a), c = Number(b.dataset.b);
      const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!d) return;
      const na = a + d[0], nc = c + d[1];
      if (na >= 1 && na <= Core.N && nc >= 1 && nc <= Core.N) { e.preventDefault(); cells[na - 1][nc - 1].focus(); }
    });
  }

  function render() {
    cells.forEach((row) => row.forEach((b) => { b.className = ""; b.setAttribute("aria-pressed", "false"); }));
    rowHeads.forEach((h) => h.classList.remove("hl")); colHeads.forEach((h) => h.classList.remove("hl"));
    if (state.picked) {
      const { a, b } = state.picked;
      for (let i = 0; i < Core.N; i++) { cells[a - 1][i].classList.add("row"); cells[i][b - 1].classList.add("row"); }
      rowHeads[a - 1].classList.add("hl"); colHeads[b - 1].classList.add("hl");
      const rel = Core.related(state);
      rel.forEach(([x, y]) => { cells[x - 1][y - 1].className = "same"; cells[x - 1][y - 1].setAttribute("aria-pressed", "true"); });
      const p = a * b;
      say(`${a} × ${b} = ${p}. The number ${p} appears ${rel.length} time${rel.length === 1 ? "" : "s"} in the table${rel.length > 1 ? ": " + rel.map(([x, y]) => `${x}×${y}`).join(", ") : ""}.`, "done");
    } else say("");
    if (window.Track) window.Track.state({ n: state.n, picked: state.picked });
  }

  document.getElementById("clearBtn").addEventListener("click", () => { state = Core.pick(state, null); render(); });
  build();
  render();
})();
