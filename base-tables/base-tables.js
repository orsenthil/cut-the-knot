"use strict";

/*
 * The page for Addition and Multiplication Tables in Various Bases: drawing
 * and input only; the arithmetic is in base-tables-core.js. A table shows
 * the + or x table of the digits of the chosen base, every entry written in
 * that base. Pick a cell (click, or move with the arrow keys) to have its
 * row and column lit and the sum or product spelled out.
 */

(function () {
  const Core = BaseTablesCore;
  const wrap = document.getElementById("table");
  const statusEl = document.getElementById("status");
  const radixIn = document.getElementById("radixIn");

  let state = Core.start();
  let sel = { a: 3, b: 4 };
  let hadFocus = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const r = state.radix, T = Core.table(state);
    sel.a = Math.min(sel.a, r - 1); sel.b = Math.min(sel.b, r - 1);
    const t = document.createElement("table");
    t.style.fontSize = r > 20 ? "0.75rem" : r > 12 ? "0.85rem" : "1rem";
    const hr = t.insertRow();
    const corner = document.createElement("th"); corner.textContent = state.op === "+" ? "+" : "×"; corner.className = "op"; hr.appendChild(corner);
    for (let b = 0; b < r; b++) { const th = document.createElement("th"); th.scope = "col"; th.textContent = Core.DIGITS[b]; if (b === sel.b) th.className = "lit"; hr.appendChild(th); }
    for (let a = 0; a < r; a++) {
      const tr = t.insertRow();
      const th = document.createElement("th"); th.scope = "row"; th.textContent = Core.DIGITS[a]; if (a === sel.a) th.className = "lit"; tr.appendChild(th);
      for (let b = 0; b < r; b++) {
        const td = tr.insertCell();
        td.textContent = T[a][b];
        td.dataset.a = String(a); td.dataset.b = String(b);
        const cls = [];
        if (a === sel.a || b === sel.b) cls.push("line");
        if (a === sel.a && b === sel.b) cls.push("sel");
        if (a === b) cls.push("diag");
        td.className = cls.join(" ");
        td.tabIndex = a === sel.a && b === sel.b ? 0 : -1;
      }
    }
    wrap.replaceChildren(t);
    if (hadFocus) { const f = wrap.querySelector("td.sel"); if (f) f.focus(); }
    const sym = state.op === "+" ? "+" : "×";
    const v = Core.value(state, sel.a, sel.b);
    say(`In base ${r}: ${Core.DIGITS[sel.a]} ${sym} ${Core.DIGITS[sel.b]} = ${Core.entry(state, sel.a, sel.b)}${r !== 10 ? `, that is ${sel.a} ${sym} ${sel.b} = ${v} in base 10` : ""}.`);
    if (window.Track) window.Track.state({ radix: r, op: state.op, a: sel.a, b: sel.b });
  }

  // Select on pointerdown: a click would be lost when focusing the cell scrolls
  // the page between the press and the release.
  wrap.addEventListener("pointerdown", (e) => {
    const td = e.target.closest("td");
    if (!td) return;
    e.preventDefault();
    sel = { a: Number(td.dataset.a), b: Number(td.dataset.b) };
    hadFocus = true;
    render();
  });
  wrap.addEventListener("keydown", (e) => {
    const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const r = state.radix;
    sel = { a: Math.max(0, Math.min(r - 1, sel.a + d[0])), b: Math.max(0, Math.min(r - 1, sel.b + d[1])) };
    hadFocus = true;
    render();
  });
  radixIn.addEventListener("change", () => {
    state = Core.start({ radix: radixIn.value, op: state.op });
    radixIn.value = String(state.radix);
    render();
  });
  document.querySelectorAll('input[name="op"]').forEach((el) => el.addEventListener("change", () => { state = Core.start({ radix: state.radix, op: el.value }); render(); }));

  render();
})();
