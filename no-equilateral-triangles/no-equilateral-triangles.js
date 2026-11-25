"use strict";

/*
 * The page for No Equilateral Triangles: drawing and input only. The ten dots
 * are real buttons laid over an SVG that shades each monochromatic triangle.
 * The rules, and the proof by trying every colouring, are in the core.
 */

(function () {
  const Core = NoEquilateralTrianglesCore;
  const board = document.getElementById("board");
  const svg = document.getElementById("lines");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const NAMES = ["orange", "red"];

  // Fit the dots in a box with a margin, y pointing down. (x: -3..3, y: 0..3 rows)
  const xs = Core.DOTS.map((p) => p.x), ys = Core.DOTS.map((p) => p.y), M = 0.9;
  const x0 = Math.min(...xs) - M, x1 = Math.max(...xs) + M, y0 = Math.min(...ys) - M * 0.8, y1 = Math.max(...ys) + M * 0.8;
  const VW = 100, VH = (100 * (y1 - y0)) / (x1 - x0);
  const sx = (p) => ((p.x - x0) / (x1 - x0)) * VW, sy = (p) => ((p.y - y0) / (y1 - y0)) * VH; // top row at the top
  board.style.aspectRatio = `${VW} / ${VH}`;
  svg.setAttribute("viewBox", `0 0 ${VW} ${VH.toFixed(2)}`);
  svg.setAttribute("preserveAspectRatio", "none");

  let state = null, tried = false;

  const polys = Core.TRIANGLES.map((t) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    g.setAttribute("points", t.map((i) => `${sx(Core.DOTS[i]).toFixed(2)},${sy(Core.DOTS[i]).toFixed(2)}`).join(" "));
    svg.appendChild(g); return g;
  });
  const dots = Core.DOTS.map((p, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "dot";
    b.style.left = (sx(p) / VW) * 100 + "%"; b.style.top = (sy(p) / VH) * 100 + "%";
    b.addEventListener("click", () => { state = Core.toggle(state, i); render(); });
    board.appendChild(b); return b;
  });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const bad = Core.mono(state);
    polys.forEach((g, k) => { g.style.display = bad.includes(k) ? "" : "none"; });
    dots.forEach((b, i) => {
      const c = state.colours[i];
      b.className = "dot " + NAMES[c];
      b.textContent = c ? "R" : "O";
      b.setAttribute("aria-label", `Dot ${i + 1}: ${NAMES[c]}. Tap to switch.`);
    });
    readout.textContent = `${bad.length} blue triangle${bad.length === 1 ? "" : "s"} of 15`;
    if (!tried) say("", null);
    if (window.Track) window.Track.state(state);
  }

  function newGame() { state = Core.start({}); tried = false; say("", null); render(); }

  document.getElementById("newBtn").addEventListener("click", newGame);
  document.getElementById("checkBtn").addEventListener("click", () => {
    const a = Core.allColourings();
    tried = true;
    say(`Tried all ${a.total.toLocaleString("en")} colourings: ${a.none} have no blue triangle. The fewest is ${a.min} (${a.atMin} colourings), so it cannot be done.`, "done");
  });
  newGame();
})();
