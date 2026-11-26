"use strict";

/*
 * The page for Pick's Theorem: drawing and input only. A geoboard of 14 x 10
 * dots. In "Add nodes" mode a press on a dot puts the next corner there (the
 * last corner joins the first); in "Delete nodes" mode it takes that corner
 * away. One focus stop on the board with arrow keys, Enter or Space for
 * keyboard play. The counts are in pick-core.js.
 */

(function () {
  const Core = PickCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const addMode = document.getElementById("addMode"), delMode = document.getElementById("delMode"), resetBtn = document.getElementById("resetBtn");
  const NS = "http://www.w3.org/2000/svg";
  const STEP = 32, PAD = 24;

  let state = Core.start();
  let cursor = { x: 6, y: 4 };

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  }

  const X = (x) => PAD + x * STEP, Y = (y) => PAD + y * STEP;

  function press(x, y) {
    state = delMode.checked ? Core.deleteNode(state, x, y) : Core.addNode(state, x, y);
    render();
  }

  function render() {
    svg.textContent = "";
    const poly = state.poly;
    const m = Core.measure(poly);
    const grid = m ? Core.classify(poly, Core.COLS, Core.ROWS) : null;
    if (poly.length >= 2) {
      el(poly.length >= 3 ? "polygon" : "polyline", { points: poly.map((p) => `${X(p.x)},${Y(p.y)}`).join(" "), class: "poly" + (poly.length >= 3 && !m ? " bad" : "") });
    }
    for (let x = 0; x < Core.COLS; x++) for (let y = 0; y < Core.ROWS; y++) {
      const kind = grid ? grid[x][y] : 0;
      el("circle", { cx: X(x), cy: Y(y), r: kind ? 5 : 3, class: "node" + (kind === 1 ? " edge" : kind === 2 ? " in" : "") });
    }
    poly.forEach((p) => el("circle", { cx: X(p.x), cy: Y(p.y), r: 8, class: "vertex" }));
    el("rect", { x: X(cursor.x) - 13, y: Y(cursor.y) - 13, width: 26, height: 26, rx: 4, class: "cursor" });
    if (poly.length < 3) {
      readout.textContent = "Put down at least three corners.";
      say("", undefined);
    } else if (!m) {
      readout.textContent = "The sides cross, touch or fold back. Delete a node or reset.";
      say("The sides must not cross.");
    } else {
      readout.textContent = `B = ${m.B}, I = ${m.I}, Area = ${m.I} + ${m.B}/2 − 1 = ${Core.areaText(m.twiceArea)}`;
      say(`Pick's formula gives area ${Core.areaText(m.twiceArea)}.`, "done");
    }
    if (window.Track) window.Track.state({ poly, mode: delMode.checked ? "delete" : "add" });
  }

  svg.addEventListener("click", (e) => {
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 464, py = ((e.clientY - r.top) / r.height) * 336;
    const x = Math.round((px - PAD) / STEP), y = Math.round((py - PAD) / STEP);
    if (x < 0 || y < 0 || x >= Core.COLS || y >= Core.ROWS) return;
    cursor = { x, y };
    press(x, y);
  });
  svg.addEventListener("keydown", (e) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) {
      e.preventDefault();
      cursor = { x: Math.min(Core.COLS - 1, Math.max(0, cursor.x + d[0])), y: Math.min(Core.ROWS - 1, Math.max(0, cursor.y + d[1])) };
      render();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      press(cursor.x, cursor.y);
    }
  });
  resetBtn.addEventListener("click", () => { state = Core.start(); render(); });
  addMode.addEventListener("change", render);
  delMode.addEventListener("change", render);
  render();
})();
