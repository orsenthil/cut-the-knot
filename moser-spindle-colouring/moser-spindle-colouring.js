"use strict";

/*
 * The page for Colour the Moser Spindle: drawing and input only. The seven
 * points are real buttons laid over an SVG of the eleven unit lines, so they
 * work with the keyboard. A click gives a point its next colour (and after the
 * last, none). A pair of joined points with the same colour is drawn red.
 */

(function () {
  const Core = MoserCore;
  const board = document.getElementById("board");
  const svg = document.getElementById("edges");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const kEl = document.getElementById("k");
  const NAMES = ["A", "B", "C", "D", "B′", "C′", "D′"];
  const COLOUR_NAMES = ["purple", "green", "amber", "coral"];
  const P = Core.points();

  // Fit the points in a box with a margin, y pointing down.
  const xs = P.map((p) => p.x), ys = P.map((p) => p.y), M = 0.55;
  const x0 = Math.min(...xs) - M, x1 = Math.max(...xs) + M, y0 = Math.min(...ys) - M, y1 = Math.max(...ys) + M;
  const VW = 100, VH = (100 * (y1 - y0)) / (x1 - x0);
  const sx = (p) => ((p.x - x0) / (x1 - x0)) * VW, sy = (p) => ((y1 - p.y) / (y1 - y0)) * VH;
  board.style.aspectRatio = `${VW} / ${VH}`;
  svg.setAttribute("viewBox", `0 0 ${VW} ${VH.toFixed(2)}`);
  svg.setAttribute("preserveAspectRatio", "none");

  let colours = Array(Core.N).fill(-1), k = 4, finished = false;
  const lines = Core.EDGES.map(([i, j]) => {
    const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
    l.setAttribute("x1", sx(P[i]).toFixed(2)); l.setAttribute("y1", sy(P[i]).toFixed(2));
    l.setAttribute("x2", sx(P[j]).toFixed(2)); l.setAttribute("y2", sy(P[j]).toFixed(2));
    svg.appendChild(l); return l;
  });
  const nodes = P.map((p, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "node";
    b.style.left = (sx(p) / VW) * 100 + "%"; b.style.top = (sy(p) / VH) * 100 + "%";
    b.addEventListener("click", () => {
      colours[i] = colours[i] + 1 >= k ? -1 : colours[i] + 1;
      finished = false; update();
    });
    board.appendChild(b); return b;
  });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function update() {
    const bad = Core.conflicts(colours);
    const badSet = new Set(bad.flat());
    nodes.forEach((b, i) => {
      b.className = "node" + (colours[i] >= 0 ? " c" + (colours[i] + 1) : "") + (badSet.has(i) ? " clash" : "");
      b.textContent = colours[i] >= 0 ? String(colours[i] + 1) : "";
      b.setAttribute("aria-label", `Point ${NAMES[i]}: ` + (colours[i] >= 0 ? `colour ${colours[i] + 1}, ${COLOUR_NAMES[colours[i]]}` : "no colour yet") + (badSet.has(i) ? ", same colour as a joined point" : ""));
    });
    lines.forEach((l, e) => l.classList.toggle("clash", bad.some(([i, j]) => i === Core.EDGES[e][0] && j === Core.EDGES[e][1])));
    const painted = colours.filter((c) => c >= 0).length;
    readout.textContent = `${k} colours · ${painted} of 7 points painted · ${bad.length} clash${bad.length === 1 ? "" : "es"}`;
    if (Core.isProper(colours, k)) say(`Done with ${k} colours: no two joined points match.`, "win");
    else if (!finished) say("", null);
    if (typeof Track !== "undefined" && Track.state) Track.state({ k, colours: colours.slice(), clashes: bad.length });
  }

  kEl.addEventListener("change", () => { k = Core.clampK(kEl.value); colours = colours.map((c) => (c >= k ? -1 : c)); finished = false; update(); });
  document.getElementById("resetBtn").addEventListener("click", () => { colours = Array(Core.N).fill(-1); finished = false; update(); });
  document.getElementById("checkBtn").addEventListener("click", () => {
    const s = Core.solve(k);
    finished = true;
    if (s) { colours = s; finished = false; update(); say(`Yes. Here is one way to do it with ${k} colours.`, "done"); }
    else say(`No. Out of all ${Math.pow(k, 7).toLocaleString("en")} ways to paint the seven points with ${k} colours, not one avoids a clash.`, "done");
  });
  update();
})();
