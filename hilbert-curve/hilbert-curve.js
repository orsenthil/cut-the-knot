"use strict";

/* Browser UI: draw the Hilbert or Moore curve for an order 1..7. */
(() => {
  const C = HilbertCurveCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const orderInput = document.getElementById("orderInput");
  const kindRadios = [...document.querySelectorAll('input[name="kind"]')];
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  function render() {
    svg.replaceChildren();
    const pts = C.points(state.order, state.kind);
    const size = 2 ** state.order;
    const step = 300 / size;
    const coords = pts.map((p) => `${p.x * step + step / 2},${p.y * step + step / 2}`);
    const path = document.createElementNS(SVG_NS, "polyline");
    path.setAttribute("points", coords.join(" "));
    path.setAttribute("class", "curve");
    svg.appendChild(path);
    orderInput.value = String(state.order);
    kindRadios.forEach((r) => { r.checked = r.value === state.kind; });
    status.textContent = `${state.kind === "hilbert" ? "Hilbert" : "Moore"} curve of order ${state.order}: ${4 ** state.order} cells of a ${size} by ${size} grid, visited one by one.`;
    if (window.Track) window.Track.state({ order: state.order, kind: state.kind, points: pts.length });
  }

  orderInput.addEventListener("input", () => {
    state = C.setOrder(state, Number(orderInput.value));
    render();
  });
  kindRadios.forEach((r) => r.addEventListener("change", () => {
    if (r.checked) { state = C.setKind(state, r.value); render(); }
  }));
  state = C.start();
  render();
})();
