"use strict";

/*
 * Changing Colors II - the page.
 *
 * The board and its moves live in changing-colors-core.js; this file draws
 * them. As in the applet, the arrows around the board are the moves: one per
 * row (far right), one per column (below), and one per line in each diagonal
 * direction, at the line's first square: up-left of it for lines running down
 * to the right (inner row on top, and the left side), up-right of it for lines
 * running down to the left (outer row on top, and the right side). Hovering or focusing an
 * arrow outlines the squares it will swap. "Show hint" marks the edge squares
 * that are not corners and counts the black ones; "numbers" shows -1 and 1.
 */

(() => {
  const C = ChangingColorsCore;

  const svg = document.getElementById("board");
  const nInput = document.getElementById("nInput");
  const viewInput = document.getElementById("viewInput");
  const hintInput = document.getElementById("hintInput");
  const backBtn = document.getElementById("backBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const countLine = document.getElementById("countLine");

  const SVG = "http://www.w3.org/2000/svg";
  const CELL = 40;
  // Room for the arrows: two rows of them on top, row arrows outside the diagonal ones on the right.
  const TOP = 74;
  const LEFT = 40;
  const RIGHT = 80;
  const BOTTOM = 40;

  let state = null;
  let cellEls = [];
  let numEls = [];
  let hintEls = [];

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  const cx = (c) => LEFT + c * CELL + CELL / 2;
  const cy = (r) => TOP + r * CELL + CELL / 2;

  function arrow(x, y, angleDeg, label, kind, k) {
    const g = el("g", { class: "arrow", tabindex: "0", role: "button", "aria-label": label, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
    g.appendChild(el("circle", { r: 10 }));
    g.appendChild(el("path", { d: "M -5 -4 L 5 0 L -5 4 Z", transform: `rotate(${angleDeg})` }));
    const cells = C.lineCells(state.n, kind, k);
    const preview = (on) => cells.forEach(([r, c]) => cellEls[r][c].classList.toggle("preview", on));
    g.addEventListener("mouseenter", () => preview(true));
    g.addEventListener("mouseleave", () => preview(false));
    g.addEventListener("focus", () => preview(true));
    g.addEventListener("blur", () => preview(false));
    const go = () => { C.swap(state, kind, k); render(); };
    g.addEventListener("click", go);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    svg.appendChild(g);
  }

  function build() {
    const n = state.n;
    svg.setAttribute("viewBox", `0 0 ${LEFT + n * CELL + RIGHT} ${TOP + n * CELL + BOTTOM}`);
    svg.replaceChildren();
    cellEls = [];
    numEls = [];
    hintEls = [];
    for (let r = 0; r < n; r++) {
      const row = [];
      const nums = [];
      for (let c = 0; c < n; c++) {
        const rect = el("rect", { x: LEFT + c * CELL, y: TOP + r * CELL, width: CELL, height: CELL, class: "cell" });
        svg.appendChild(rect);
        row.push(rect);
        const t = el("text", { x: cx(c), y: cy(r), class: "num" });
        svg.appendChild(t);
        nums.push(t);
      }
      cellEls.push(row);
      numEls.push(nums);
    }
    for (const [r, c] of C.hintCells(n)) {
      const h = el("rect", { x: LEFT + c * CELL + 4, y: TOP + r * CELL + 4, width: CELL - 8, height: CELL - 8, rx: 4, class: "hint" });
      svg.appendChild(h);
      hintEls.push(h);
    }
    const right = LEFT + n * CELL;
    const bottom = TOP + n * CELL;
    for (let r = 0; r < n; r++) arrow(right + 56, cy(r), 180, `Swap row ${r + 1}`, "row", r);
    for (let c = 0; c < n; c++) arrow(cx(c), bottom + 20, -90, `Swap column ${c + 1}`, "col", c);
    // Lines running down to the right (r - c constant) start on the top or left edge:
    // their arrows sit up-left of the first square, in the inner row along the top.
    for (let k = 0; k < 2 * n - 1; k++) {
      const [r, c] = C.lineCells(n, "diag", k)[0];
      const [x, y] = r === 0 ? [cx(c) - 20, TOP - 20] : [LEFT - 20, cy(r) - 20];
      arrow(x, y, 45, `Swap the slanting line through row ${r + 1}, column ${c + 1}, running down to the right`, "diag", k);
    }
    // Lines running down to the left (r + c constant) start on the top or right edge:
    // their arrows sit up-right of the first square, in the outer row along the top.
    for (let k = 0; k < 2 * n - 1; k++) {
      const [r, c] = C.lineCells(n, "anti", k).sort((a, b) => a[0] - b[0])[0];
      const [x, y] = r === 0 ? [cx(c) + 20, TOP - 50] : [right + 20, cy(r) - 20];
      arrow(x, y, 135, `Swap the slanting line through row ${r + 1}, column ${c + 1}, running down to the left`, "anti", k);
    }
  }

  function render() {
    const n = state.n;
    const numbers = viewInput.value === "numbers";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const black = state.cells[r][c];
        cellEls[r][c].setAttribute("class", "cell" + (black ? " black" : "") + (cellEls[r][c].classList.contains("preview") ? " preview" : ""));
        numEls[r][c].textContent = numbers ? (black ? "-1" : "1") : "";
        numEls[r][c].setAttribute("class", "num" + (black ? " on-black" : ""));
      }
    }
    for (const h of hintEls) h.style.display = hintInput.checked ? "" : "none";
    const all = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) all.push([r, c]);
    const black = C.blackCount(state, all);
    const inHint = C.blackCount(state, C.hintCells(n));
    countLine.textContent = `Black squares: ${black}` + (hintInput.checked ? ` · in the hint: ${inHint} (${inHint % 2 ? "odd" : "even"})` : "");
    backBtn.disabled = state.history.length === 0;
    if (C.monochrome(state)) {
      statusEl.textContent = "One colour!";
      statusEl.className = "win";
    } else {
      statusEl.textContent = "";
      statusEl.className = "";
    }
  }

  function reset() {
    state = C.start(Number(nInput.value));
    build();
    render();
  }

  for (const n of C.SIZES) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = n + " by " + n;
    if (n === C.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }
  nInput.addEventListener("change", reset);
  resetBtn.addEventListener("click", reset);
  viewInput.addEventListener("change", render);
  hintInput.addEventListener("change", render);
  backBtn.addEventListener("click", () => { if (C.takeBack(state)) render(); });

  reset();
})();
