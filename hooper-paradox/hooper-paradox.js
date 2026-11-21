"use strict";

/* Browser UI: the four dissection pieces, with parameters and a hint. */
(() => {
  const C = HooperParadoxCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const wInput = document.getElementById("wInput");
  const hInput = document.getElementById("hInput");
  const aInput = document.getElementById("aInput");
  const hintCheck = document.getElementById("hintCheck");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  function render() {
    svg.replaceChildren();
    const r = C.analyze(state.w, state.h, state.cut);
    const scale = 22;
    const ox = 30;
    const oy = 20;
    const colors = ["blue", "warm", "green", "gold"];
    r.pieces.forEach((piece, i) => {
      const poly = document.createElementNS(SVG_NS, "polygon");
      poly.setAttribute("points", piece.points.map((p) => `${ox + p.x * scale},${oy + p.y * scale}`).join(" "));
      poly.setAttribute("class", "piece " + colors[i % colors.length]);
      poly.setAttribute("aria-label", `${piece.name}, area ${piece.area}`);
      svg.appendChild(poly);
      const cx = piece.points.reduce((s, p) => s + p.x, 0) / piece.points.length;
      const cy = piece.points.reduce((s, p) => s + p.y, 0) / piece.points.length;
      const t = document.createElementNS(SVG_NS, "text");
      t.setAttribute("x", ox + cx * scale);
      t.setAttribute("y", oy + cy * scale + 4);
      t.textContent = String(i + 1);
      svg.appendChild(t);
    });

    wInput.value = String(state.w);
    hInput.value = String(state.h);
    aInput.value = String(state.cut);
    status.textContent = hintCheck.checked
      ? `The pieces still cover exactly ${r.pieceTotal} square units — the same as the original. The "gain" is a thin gap hidden along the joins.`
      : `${state.w} × ${state.h} = ${r.originalArea} square units, cut into ${r.pieces.length} pieces of areas ${r.pieces.map((p) => p.area).join(", ")}.`;
    if (window.Track) window.Track.state({ w: state.w, h: state.h, cut: state.cut, areas: r.pieces.map((p) => p.area), conserved: r.conserved });
  }

  function bind(input, key) {
    input.addEventListener("change", () => {
      state = C.set(state, key, Number(input.value));
      render();
    });
  }
  bind(wInput, "w");
  bind(hInput, "h");
  bind(aInput, "cut");
  hintCheck.addEventListener("change", render);
  state = C.start();
  render();
})();
