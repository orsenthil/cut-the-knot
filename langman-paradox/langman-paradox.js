"use strict";

/* Browser UI: Langman's Fibonacci dissection with an exaggerated gap. */
(() => {
  const C = LangmanParadoxCore;
  const squareSvg = document.getElementById("squareBoard");
  const rectSvg = document.getElementById("rectBoard");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nInput = document.getElementById("nInput");
  const cheatCheck = document.getElementById("cheatCheck");
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
    pieces.forEach((p) => g.appendChild(el("polygon", {
      points: p.points.map((q) => `${q.x},${q.y}`).join(" "),
      class: "piece " + p.name,
      "aria-label": `${p.name} piece, area ${p.area}`,
    })));
    if (showSliver && sliver) g.appendChild(el("polygon", {
      points: sliver.map((q) => `${q.x},${q.y}`).join(" "), class: "sliver",
    }));
    svg.appendChild(g);
  }

  function render() {
    const r = C.analyze(state);
    draw(squareSvg, r.square, r.f, r.f, null, false);
    draw(rectSvg, r.rectangle, r.f + r.a, r.a, r.sliver, true);
    nInput.value = String(state.n);
    cheatCheck.checked = state.cheat;
    readout.textContent = `${r.f}×${r.f} = ${r.squareArea} · ${r.a}×${r.f + r.a} = ${r.rectangleArea} · Cassini difference ${r.cassini}`;
    status.textContent = `The pieces always cover ${r.pieceTotal} square units. The rectangle outline claims ${r.rectangleArea}; the extra unit is hidden in the sloping join${state.cheat ? ", which is exaggerated here" : ""}.`;
    status.className = "done";
    if (window.Track) window.Track.state({
      n: state.n, cheat: state.cheat, side: r.f, rectangleA: r.a, rectangleB: r.f + r.a,
      squareArea: r.squareArea, rectangleArea: r.rectangleArea, cassini: r.cassini,
    });
  }

  nInput.addEventListener("input", () => { state = C.setN(state, Number(nInput.value)); render(); });
  cheatCheck.addEventListener("change", () => { state = C.toggleCheat(state); render(); });
  state = C.start();
  render();
})();
