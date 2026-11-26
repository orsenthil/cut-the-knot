"use strict";

/*
 * The page for Pascal's triangle: drawing and input only. One SVG shows the
 * dots in one of three arrangements, each with its count. Pressing a dot marks
 * it and the two dots it is reached from. The numbers are in
 * pascal-triangle-core.js.
 */

(function () {
  const Core = PascalTriangleCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const formSel = document.getElementById("formSel");
  const rowsIn = document.getElementById("rowsIn");
  const arrowsIn = document.getElementById("arrowsIn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || svg).appendChild(e);
    return e;
  }

  function render() {
    svg.textContent = "";
    const rows = state.rows, T = Core.build(rows);
    // lay out in step units, then fit the picture into 400 x 400
    let minX = Infinity, maxX = -Infinity, maxY = 0;
    for (let n = 0; n < rows; n++) for (let m = 0; m <= n; m++) {
      const p = Core.place(state.form, n, m);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
    }
    const pad = 24, spanX = Math.max(1, maxX - minX), spanY = Math.max(1, maxY);
    const step = Math.min((400 - 2 * pad) / spanX, (400 - 2 * pad) / spanY);
    const r = Math.max(7, Math.min(16, step * 0.42));
    const offX = (400 - spanX * step) / 2, offY = (400 - spanY * step) / 2;
    const at = (n, m) => {
      const p = Core.place(state.form, n, m);
      return { x: offX + (p.x - minX) * step, y: offY + p.y * step };
    };
    const parentSet = new Set();
    if (state.pick) Core.parents(state.pick[0], state.pick[1]).forEach(([a, b]) => parentSet.add(a + "," + b));
    if (state.arrows) {
      for (let n = 1; n < rows; n++) for (let m = 0; m <= n; m++) {
        const to = at(n, m);
        Core.parents(n, m).forEach(([a, b]) => {
          const from = at(a, b);
          el("line", { x1: from.x.toFixed(1), y1: from.y.toFixed(1), x2: to.x.toFixed(1), y2: to.y.toFixed(1), class: "arrow" });
        });
      }
    }
    for (let n = 0; n < rows; n++) for (let m = 0; m <= n; m++) {
      const p = at(n, m);
      const isPick = state.pick && state.pick[0] === n && state.pick[1] === m;
      const g = el("g", {});
      const c = el("circle", {
        cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: r.toFixed(1), tabindex: "0", role: "button",
        "aria-label": `Row ${n}, place ${m}: ${T[n][m]} ways`,
        class: "dot" + (isPick ? " pick" : "") + (parentSet.has(n + "," + m) ? " parent" : ""),
      }, g);
      const label = String(T[n][m]);
      const t = el("text", { x: p.x.toFixed(1), y: p.y.toFixed(1), style: `font-size:${Math.min(13, r * 1.6 / Math.max(1, label.length * 0.7)).toFixed(1)}px` }, g);
      t.textContent = label;
      const choose = () => { state = Object.assign({}, state, { pick: [n, m] }); render(); };
      c.addEventListener("click", choose);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    }
    formSel.value = state.form;
    rowsIn.value = String(rows);
    arrowsIn.checked = state.arrows;
    if (state.pick) {
      const [n, m] = state.pick, ps = Core.parents(n, m);
      readout.textContent = ps.length === 2
        ? `C(${n}, ${m}) = C(${n - 1}, ${m - 1}) + C(${n - 1}, ${m}) = ${T[n - 1][m - 1]} + ${T[n - 1][m]} = ${T[n][m]}`
        : `C(${n}, ${m}) = ${T[n][m]}: only one way, straight down the edge.`;
      say(`Row ${n} adds up to ${T[n].reduce((a, b) => a + b, 0)} = 2^${n}.`, "done");
    } else {
      readout.textContent = `${rows} rows. Press a dot to see where its number comes from.`;
      say("");
    }
    if (window.Track) window.Track.state({ rows: state.rows, form: state.form, arrows: state.arrows, pick: state.pick });
  }

  function change(patch) { state = Object.assign({}, state, patch); render(); }
  formSel.addEventListener("change", () => change({ form: formSel.value }));
  rowsIn.addEventListener("input", () => change({ rows: Core.clampRows(rowsIn.value), pick: null }));
  arrowsIn.addEventListener("change", () => change({ arrows: arrowsIn.checked }));

  render();
})();
