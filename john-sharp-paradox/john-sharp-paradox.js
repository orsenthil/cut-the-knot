"use strict";

/* Browser UI: the three pieces in the square and in the false rectangle. */
(() => {
  const C = JohnSharpParadoxCore;
  const squareSvg = document.getElementById("squareBoard");
  const rectSvg = document.getElementById("rectBoard");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nInput = document.getElementById("nInput");
  const revealBtn = document.getElementById("revealBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function draw(svg, pieces, width, height, sliver, showSliver) {
    svg.replaceChildren();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const g = el("g", { transform: `translate(0,${height}) scale(1,-1)` });
    pieces.forEach((p) => {
      const poly = el("polygon", {
        points: p.points.map((q) => `${q.x},${q.y}`).join(" "),
        class: "piece " + p.name,
        "aria-label": `${p.name} piece, area ${p.area}`,
      });
      g.appendChild(poly);
    });
    if (showSliver && sliver) {
      g.appendChild(el("polygon", {
        points: sliver.map((q) => `${q.x},${q.y}`).join(" "),
        class: "sliver",
      }));
    }
    svg.appendChild(g);
  }

  function render() {
    const r = C.analyze(state);
    draw(squareSvg, r.square, r.f, r.f, null, false);
    draw(rectSvg, r.rectangle, r.f + r.a, r.a, r.sliver, state.revealed);
    nInput.value = String(state.n);
    revealBtn.textContent = state.revealed ? "Hide the sliver" : "Reveal the sliver";
    readout.textContent = `${r.f}×${r.f} = ${r.squareArea} square units · ${r.a}×${r.f + r.a} = ${r.rectangleArea} · difference ${r.discrepancy}`;
    status.textContent = state.revealed
      ? `The three pieces never change area (${r.pieceTotal} in both pictures). The extra unit hides in the thin strip along the false diagonal: ${r.cassini} = F(n)² − F(n−1)F(n+1).`
      : `The same three pieces seem to lose one square unit. Where could it have gone? Press "Reveal the sliver".`;
    status.classList.remove("win", "done");
    status.classList.add(state.revealed ? "win" : "done");
    if (window.Track) window.Track.state({
      n: state.n, side: r.f, rectA: r.a, rectB: r.f + r.a,
      squareArea: r.squareArea, rectangleArea: r.rectangleArea,
      discrepancy: r.discrepancy, revealed: state.revealed,
    });
  }

  nInput.addEventListener("input", () => { state = C.setN(state, Number(nInput.value)); render(); });
  revealBtn.addEventListener("click", () => { state = C.reveal(state); render(); });
  state = C.start();
  render();
})();
