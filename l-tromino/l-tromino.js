"use strict";

/*
 * Tiling Rectangles with L-Trominoes - the page.
 *
 * The board's rules live in l-tromino-core.js; this file draws it. As in the
 * applet, a piece takes three clicks and the middle one is the corner; "Wire"
 * shows each piece as a bent line through its three squares, "Blocks" fills
 * it; "Remove last" takes back the last piece. The applet followed the mouse
 * between clicks with a rubber line; here the squares picked so far are
 * outlined instead. One square at a time is in the tab order; the arrow keys
 * move and Enter or Space picks.
 */

(() => {
  const T = LTrominoCore;
  const SVG = "http://www.w3.org/2000/svg";
  const CELL = 40;
  const COLOURS = ["#d0463b", "#3d74c4", "#dda01b", "#3d9a5c", "#8a5cc2", "#d0773b", "#2f9aa3", "#c2508a"];

  const svg = document.getElementById("board");
  const rowsInput = document.getElementById("rowsInput");
  const colsInput = document.getElementById("colsInput");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  let s = null;
  let focus = [0, 0];
  let cells = [];

  const el = (name, attrs) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const say = (t, cls) => { statusEl.textContent = t; statusEl.className = cls || ""; };
  const view = () => document.querySelector('input[name="view"]:checked').value;
  const centre = ([r, c]) => [c * CELL + CELL / 2 + 2, r * CELL + CELL / 2 + 2];

  function build() {
    svg.setAttribute("viewBox", `0 0 ${s.cols * CELL + 4} ${s.rows * CELL + 4}`);
    svg.style.maxWidth = Math.min(460, s.cols * 46) + "px";
    svg.replaceChildren();
    cells = [];
    for (let r = 0; r < s.rows; r++) {
      const row = el("g", { role: "row" });
      const line = [];
      for (let c = 0; c < s.cols; c++) {
        const sq = el("rect", { x: c * CELL + 2, y: r * CELL + 2, width: CELL, height: CELL, class: "sq", role: "gridcell", tabindex: "-1" });
        sq.addEventListener("click", () => pick(r, c));
        sq.addEventListener("keydown", (e) => key(e, r, c));
        row.appendChild(sq);
        line.push(sq);
      }
      svg.appendChild(row);
      cells.push(line);
    }
    svg.appendChild(el("g", { id: "art" }));
  }

  /** The first colour that no piece touching piece i (placed before it) uses, so neighbours differ. */
  function colourOf(i) {
    const used = new Set();
    for (const [r, c] of s.pieces[i]) {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = s.owner[r + dr] && s.owner[r + dr][c + dc];
        if (o !== undefined && o >= 0 && o < i) used.add(colourOf(o));
      }
    }
    let k = 0;
    while (used.has(k)) k++;
    return k % COLOURS.length;
  }

  function render() {
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const taken = s.owner[r][c] >= 0;
        const picked = s.building.some(([x, y]) => x === r && y === c);
        cells[r][c].setAttribute("class", "sq" + (taken ? " taken" : "") + (picked ? " picked" : ""));
        cells[r][c].setAttribute("tabindex", r === focus[0] && c === focus[1] ? "0" : "-1");
        cells[r][c].setAttribute("aria-label", `row ${r + 1}, column ${c + 1}: ${taken ? "covered" : picked ? "picked" : "empty"}`);
      }
    }
    const art = document.getElementById("art");
    art.replaceChildren();
    s.pieces.forEach((p, i) => {
      if (view() === "blocks") {
        for (const [r, c] of p) art.appendChild(el("rect", { x: c * CELL + 4, y: r * CELL + 4, width: CELL - 4, height: CELL - 4, rx: 4, class: "block", fill: COLOURS[colourOf(i)] }));
      } else {
        art.appendChild(el("polyline", { points: p.map((q) => centre(q).join(",")).join(" "), class: "wire" }));
        for (const q of [p[0], p[2]]) { const [x, y] = centre(q); art.appendChild(el("circle", { cx: x, cy: y, r: 5, class: "wire-dot" })); }
      }
    });
    undoBtn.disabled = s.pieces.length === 0;
    if (T.finished(s)) say(`Covered! ${s.pieces.length} pieces tile the ${s.rows} by ${s.cols} rectangle.`, "win");
  }

  function pick(r, c) {
    focus = [r, c];
    const res = T.click(s, r, c);
    if (res === "refused") say("That square is already covered.", "");
    else if (!T.finished(s)) say(res === "added" && s.building.length === 2 ? "Now a square next to it, turning the corner." : "", "");
    render();
  }

  function key(e, r, c) {
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (step) {
      e.preventDefault();
      focus = [Math.min(s.rows - 1, Math.max(0, r + step[0])), Math.min(s.cols - 1, Math.max(0, c + step[1]))];
      render();
      cells[focus[0]][focus[1]].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(r, c);
    }
  }

  function reset() {
    s = T.start(Number(rowsInput.value), Number(colsInput.value));
    focus = [0, 0];
    build();
    say("", "");
    render();
  }

  for (const [sel, def] of [[rowsInput, T.DEFAULT_ROWS], [colsInput, T.DEFAULT_COLS]]) {
    for (let n = T.MIN; n <= T.MAX; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = String(n);
      if (n === def) o.selected = true;
      sel.appendChild(o);
    }
    sel.addEventListener("change", reset);
  }
  for (const r of document.querySelectorAll('input[name="view"]')) r.addEventListener("change", render);
  undoBtn.addEventListener("click", () => { if (T.removeLast(s)) { say("", ""); render(); } });
  resetBtn.addEventListener("click", reset);

  reset();
})();
