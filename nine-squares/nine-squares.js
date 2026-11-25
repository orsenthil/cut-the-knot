"use strict";

/*
 * The page for Nine Squares: drawing and input only. One SVG in the squares'
 * own units (the black square is 1 wide), so the picture simply grows and
 * shrinks as a changes. The rules are in nine-squares-core.js.
 */

(function () {
  const Core = NineSquaresCore;
  const svg = document.getElementById("board");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const sizes = document.getElementById("sizes");
  const aIn = document.getElementById("aIn"), aOut = document.getElementById("aOut"), nineBtn = document.getElementById("nineBtn");
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = { black: null, blue: "#3b6fe0", a1: "#f0a23a", a5: "#e58bb0", a9: "#3aa57a", am1: "#8f86ff", red4: "#e0566b", am2: "#d9792b", red15: "#e0566b" };

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text !== undefined) e.textContent = text;
    svg.appendChild(e);
    return e;
  }

  function render() {
    svg.textContent = "";
    sizes.textContent = "";
    const sq = Core.squares(state);
    sq.forEach((s) => {
      const r = el("rect", { x: s.x, y: s.y, width: s.side, height: s.side, class: s.id === "black" ? "black" : "" });
      if (COLORS[s.id]) r.setAttribute("fill", COLORS[s.id]);
      if (s.side >= 3) el("text", { x: s.x + s.side / 2, y: s.y + s.side / 2 }, String(s.side));
      const li = document.createElement("li");
      const sw = document.createElement("span");
      sw.className = "sw";
      sw.style.background = COLORS[s.id] || "var(--ink)";
      li.appendChild(sw);
      li.appendChild(document.createTextNode(`${s.label.replace("a", "a")} = ${s.side}`));
      sizes.appendChild(li);
    });
    const d = Core.describe(state);
    aIn.value = String(state.a);
    aOut.textContent = String(state.a);
    if (d.tiles) {
      readout.textContent = `The squares fit together exactly: a ${d.width} by ${d.height} rectangle, and all nine sides are different.`;
      say("A perfect rectangle of nine different squares.", "done");
    } else {
      const parts = [];
      if (d.overlaps) parts.push(`${d.overlaps} pair${d.overlaps === 1 ? "" : "s"} of squares overlap`);
      if (d.gap > 0) parts.push(`there are gaps (${d.gap} unit squares of the ${d.width} by ${d.height} frame are empty)`);
      const lead = parts.join(", and ");
      readout.textContent = lead.charAt(0).toUpperCase() + lead.slice(1) + ". The black square is 1, the red ones 4 and 15, whatever a is.";
      say("");
    }
    if (window.Track) window.Track.state({ a: state.a, tiles: d.tiles });
  }

  function set(next) { if (next) { state = next; render(); } }
  aIn.addEventListener("input", () => set(Core.setA(state, aIn.value)));
  nineBtn.addEventListener("click", () => set(Core.setA(state, 9)));
  render();
})();
