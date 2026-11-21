"use strict";

/* Browser UI: an n-gon in a circle, with a slider for n and the two perimeters. */
(() => {
  const C = ArchimedesCircumferenceCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const readout = document.getElementById("readout");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  function render() {
    svg.replaceChildren();
    const r = C.analyze(state.n, state.radius);
    const pts = C.polygonPoints(state.n, 1);
    const cx = 150;
    const cy = 150;
    const scale = 120;
    const P = (p) => `${cx + p.x * scale},${cy + p.y * scale}`;
    svg.appendChild(document.createElementNS(SVG_NS, "circle"));
    const circle = svg.lastChild;
    circle.setAttribute("cx", cx);
    circle.setAttribute("cy", cy);
    circle.setAttribute("r", scale);
    circle.setAttribute("class", "circle");
    const poly = document.createElementNS(SVG_NS, "polygon");
    poly.setAttribute("points", pts.map(P).join(" "));
    poly.setAttribute("class", "polygon");
    svg.appendChild(poly);
    pts.forEach((p) => {
      const dot = document.createElementNS(SVG_NS, "circle");
      dot.setAttribute("cx", cx + p.x * scale);
      dot.setAttribute("cy", cy + p.y * scale);
      dot.setAttribute("r", 4);
      dot.setAttribute("class", "vertex");
      svg.appendChild(dot);
    });

    nInput.value = String(state.n);
    readout.textContent = `n = ${state.n}   inscribed P = ${r.inscribed.toFixed(4)}   circumscribed C = ${r.circumscribed.toFixed(4)}   2π = ${r.circumference.toFixed(4)}   gap = ${r.gap.toFixed(4)}`;
    say(`The ${state.n}-gon's perimeter ${r.inscribed.toFixed(3)} sits below the circle's ${(2 * Math.PI).toFixed(3)}.`);
    if (window.Track) window.Track.state({ n: state.n, inscribed: r.inscribed, circumscribed: r.circumscribed });
  }

  function say(text) { status.textContent = text; status.classList.add("done"); }
  nInput.addEventListener("input", () => {
    state = C.setN(state, Number(nInput.value));
    render();
  });
  state = C.start();
  render();
})();
