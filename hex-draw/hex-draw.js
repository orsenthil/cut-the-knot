"use strict";

/*
 * Hex Can't End in a Draw - the page.
 *
 * The board logic lives in hex-draw-core.js; this file draws the board and
 * handles clicks. Around the board is the ring of edge cells Gale's proof
 * adds (red above and below, blue left and right), drawn faintly. Cells of
 * the winning path get a dot. "Separation edges" draws Gale's walk on the
 * hexagonal grid, which is the only grid where the applet offered it.
 *
 * One cell at a time is in the tab order; arrows move, Enter or Space swaps.
 */

(() => {
  const H = HexDrawCore;

  const svg = document.getElementById("board");
  const gridInput = document.getElementById("gridInput");
  const nInput = document.getElementById("nInput");
  const walkInput = document.getElementById("walkInput");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  const SVG = "http://www.w3.org/2000/svg";
  const S = 20; // hexagon radius, or half a square's side, in viewBox units

  let state = null;
  let focusCell = [0, 0];
  let polys = [];

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  const isHex = () => state.grid === "hex";

  /** Centre of cell (i, j) in viewBox units; edge cells use i or j of -1 or n. */
  function centreOf(i, j) {
    if (isHex()) {
      const [x, y] = H.centre(i, j);
      return [x * S, y * S];
    }
    return [j * 2 * S, i * 2 * S];
  }

  function shapePoints(i, j, shrink = 0) {
    if (isHex()) {
      return H.corners(i, j).map(([x, y]) => {
        const [cx, cy] = H.centre(i, j);
        const k = 1 - shrink;
        return ((cx + (x - cx) * k) * S).toFixed(2) + "," + ((cy + (y - cy) * k) * S).toFixed(2);
      }).join(" ");
    }
    const [cx, cy] = centreOf(i, j);
    const h = S * (1 - shrink);
    return [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h]].map((p) => p.join(",")).join(" ");
  }

  function build() {
    const n = state.n;
    svg.replaceChildren();
    // Bounding box over the edge ring.
    const pts = [];
    for (let i = -1; i <= n; i++) for (let j = -1; j <= n; j++) pts.push(centreOf(i, j));
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const pad = S * 1.2;
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    svg.setAttribute("viewBox", `${minX.toFixed(1)} ${minY.toFixed(1)} ${(Math.max(...xs) - minX + pad).toFixed(1)} ${(Math.max(...ys) - minY + pad).toFixed(1)}`);

    for (let i = -1; i <= n; i++) {
      for (let j = -1; j <= n; j++) {
        const outI = i < 0 || i >= n;
        const outJ = j < 0 || j >= n;
        if (outI === outJ) continue; // board cells, and the four corners that belong to no edge
        svg.appendChild(el("polygon", { points: shapePoints(i, j, 0.06), class: "edge " + (outI ? "red" : "blue") }));
      }
    }
    polys = [];
    for (let i = 0; i < n; i++) {
      const row = el("g", { role: "row" });
      const line = [];
      for (let j = 0; j < n; j++) {
        const p = el("polygon", { points: shapePoints(i, j, 0.04), class: "cell", role: "gridcell", tabindex: "-1" });
        p.addEventListener("click", () => flip(i, j));
        p.addEventListener("keydown", (e) => key(e, i, j));
        row.appendChild(p);
        line.push(p);
      }
      svg.appendChild(row);
      polys.push(line);
    }
    svg.appendChild(el("g", { id: "marks" }));
  }

  function render() {
    const { n, cells } = state;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const p = polys[i][j];
        p.setAttribute("class", "cell " + (cells[i][j] ? "red" : "blue"));
        p.setAttribute("aria-label", `row ${i + 1}, column ${j + 1}: ${cells[i][j] ? "red" : "blue"}`);
        p.setAttribute("tabindex", i === focusCell[0] && j === focusCell[1] ? "0" : "-1");
      }
    }
    const marks = document.getElementById("marks");
    marks.replaceChildren();
    const c = H.chains(state);
    // As in the applet: blue's path if it has one, else red's; on the 8-grid, both.
    const shown = state.grid === "sq8" ? [c.red, c.blue].filter(Boolean) : [c.blue || c.red].filter(Boolean);
    for (const path of shown) {
      for (const [i, j] of path) {
        const [x, y] = centreOf(i, j);
        marks.appendChild(el("circle", { cx: x, cy: y, r: S * 0.28, class: "dot" }));
      }
    }
    if (isHex() && walkInput.checked) {
      const w = H.galeWalk(state);
      const pts = w.points.map(([x, y]) => (x * S).toFixed(2) + "," + (y * S).toFixed(2)).join(" ");
      marks.appendChild(el("polyline", { points: pts, class: "walk" }));
      const [ex, ey] = w.points[w.points.length - 1];
      const [sx, sy] = w.points[0];
      marks.appendChild(el("circle", { cx: sx * S, cy: sy * S, r: 4, class: "walk-end" }));
      marks.appendChild(el("circle", { cx: ex * S, cy: ey * S, r: 4, class: "walk-end" }));
    }
    walkInput.disabled = !isHex();

    if (c.red && c.blue) statusEl.textContent = "Both win! A red path and a blue path cross at a diagonal.";
    else if (c.red) statusEl.textContent = "Red wins: a red path joins the top and the bottom.";
    else if (c.blue) statusEl.textContent = "Blue wins: a blue path joins the left and the right.";
    else statusEl.textContent = "Nobody wins: this board is a draw.";
    statusEl.className = c.red && c.blue ? "win" : c.red || c.blue ? "" : "lose";
  }

  function flip(i, j) {
    H.toggle(state, i, j);
    focusCell = [i, j];
    render();
  }

  function key(e, i, j) {
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
    if (step) {
      e.preventDefault();
      const a = Math.min(state.n - 1, Math.max(0, i + step[0]));
      const b = Math.min(state.n - 1, Math.max(0, j + step[1]));
      focusCell = [a, b];
      render();
      polys[a][b].focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip(i, j);
    }
  }

  function reset() {
    state = H.start(Number(nInput.value), gridInput.value);
    focusCell = [0, 0];
    build();
    render();
  }

  for (let n = H.MIN_N; n <= H.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = n + " by " + n;
    if (n === H.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }
  gridInput.addEventListener("change", reset);
  nInput.addEventListener("change", reset);
  walkInput.addEventListener("change", render);
  resetBtn.addEventListener("click", reset);

  reset();
})();
