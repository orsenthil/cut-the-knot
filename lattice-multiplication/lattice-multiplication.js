"use strict";

/* Browser UI: draw the lattice, its diagonal bands and the carried product. */
(() => {
  const C = LatticeMultiplicationCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const aInput = document.getElementById("aInput");
  const bInput = document.getElementById("bInput");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function render() {
    const r = C.analyze(state);
    const m = r.digitsA.length;
    const n = r.digitsB.length;
    const cell = 42;
    const left = 40;
    const top = 40;
    svg.replaceChildren();
    const columns = Math.max(m, r.bands.length);
    svg.setAttribute("viewBox", `0 0 ${left + columns * cell + 20} ${top + n * cell + 50}`);

    r.digitsA.forEach((d, i) => {
      const t = el("text", { x: left + i * cell + cell / 2, y: top - 12, class: "factor" });
      t.textContent = String(d);
      svg.appendChild(t);
    });
    r.digitsB.forEach((d, j) => {
      const t = el("text", { x: left + m * cell + 12, y: top + j * cell + cell / 2 + 5, class: "factor" });
      t.textContent = String(d);
      svg.appendChild(t);
    });

    r.cells.forEach((row, i) => {
      row.forEach((c, j) => {
        const x = left + i * cell;
        const y = top + j * cell;
        svg.appendChild(el("rect", { x, y, width: cell, height: cell, class: "cell" }));
        svg.appendChild(el("line", { x1: x, y1: y, x2: x + cell, y2: y + cell, class: "diagonal" }));
        const tens = el("text", { x: x + 10, y: y + 16, class: "digit" });
        tens.textContent = c.tens ? String(c.tens) : "";
        svg.appendChild(tens);
        const units = el("text", { x: x + cell - 10, y: y + cell - 8, class: "digit" });
        units.textContent = String(c.units);
        svg.appendChild(units);
      });
    });

    r.bands.forEach((sum, k) => {
      const t = el("text", { x: left + k * cell + cell / 2, y: top + n * cell + 26, class: "band" + (sum > 9 ? " carry" : "") });
      t.textContent = String(sum);
      svg.appendChild(t);
    });

    aInput.value = String(state.a);
    bInput.value = String(state.b);
    readout.textContent = `${state.a} × ${state.b} = ${r.product.toLocaleString()} · ordinary multiplication gives ${r.expected.toLocaleString()}`;
    status.textContent = r.product === r.expected
      ? r.needsCarry
        ? `Diagonal sums are ${r.bands.join(", ")}; carrying gives ${r.product}.`
        : `Every diagonal sum is one digit, so the product ${r.product} reads straight off.`
      : "The lattice product does not match — something went wrong.";
    status.className = r.product === r.expected ? "win" : "lose";
    if (window.Track) window.Track.state({
      a: state.a, b: state.b, bands: r.bands.slice(), product: r.product,
      expected: r.expected, needsCarry: r.needsCarry,
    });
  }

  aInput.addEventListener("change", () => { state = C.setA(state, Number(aInput.value)); render(); });
  bInput.addEventListener("change", () => { state = C.setB(state, Number(bInput.value)); render(); });
  state = C.start();
  render();
})();
