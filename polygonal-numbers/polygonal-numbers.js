"use strict";

/*
 * The page for Polygonal Numbers: drawing and input only. The dots come from
 * polygonal-numbers-core.js. An SVG shows the nested polygons sharing their
 * left corner; the dots added by the largest polygon (its gnomon) are in the
 * accent colour, the older ones in ink, and each polygon's outline is faint.
 */

(function () {
  const Core = PolygonalNumbersCore;
  const NS = "http://www.w3.org/2000/svg";
  const pic = document.getElementById("pic");
  const sidesIn = document.getElementById("sides");
  const sizeIn = document.getElementById("size");
  const readout = document.getElementById("readout");

  const NAMES = { 3: "triangular", 4: "square", 5: "pentagonal", 6: "hexagonal", 7: "heptagonal", 8: "octagonal", 9: "nonagonal", 10: "decagonal", 11: "hendecagonal", 12: "dodecagonal" };
  const name = (N) => NAMES[N] || `${N}-gonal`;
  const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th"}`;

  let state = Core.start({ sides: Number(sidesIn.value), size: Number(sizeIn.value) });

  const el = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function render() {
    const dots = Core.dots(state);
    const xs = dots.map((d) => d.x), ys = dots.map((d) => d.y);
    const pad = 0.8;
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
    const w = Math.max(...xs) - minX + pad, h = Math.max(...ys) - minY + pad;
    pic.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
    pic.replaceChildren();

    // Outlines: the polygon of side k, corner at the origin.
    const N = state.sides, interior = (Math.PI * (N - 2)) / N;
    for (let k = 1; k <= state.size; k++) {
      let x = 0, y = 0, a = interior / 2;
      const pts = ["0,0"];
      for (let s = 0; s < N; s++) { x += k * Math.cos(a); y += k * Math.sin(a); a -= Math.PI - interior; pts.push(`${x},${y}`); }
      pic.append(el("polygon", { points: pts.join(" "), class: k === state.size ? "edge outer" : "edge" }));
    }
    const r = 0.3;
    for (const d of dots) pic.append(el("circle", { cx: d.x, cy: d.y, r, class: d.layer === state.size && !(d.x === 0 && d.y === 0) ? "dot new" : "dot" }));

    const info = Core.describe(state);
    const text = `${info.dots} dots: the ${ordinal(info.n)} ${name(N)} number. The largest ${N}-gon added ${info.newDots} new dots.`;
    readout.textContent = text;
    pic.setAttribute("aria-label", `${state.size} nested ${N}-sided polygons sharing a corner, ${text}`);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function read() {
    state = Core.start({ sides: Math.round(Number(sidesIn.value)), size: Math.round(Number(sizeIn.value)) });
    sidesIn.value = state.sides;
    sizeIn.value = state.size;
    render();
  }
  for (const input of [sidesIn, sizeIn]) {
    input.addEventListener("change", read);
    input.addEventListener("input", () => { if (input.checkValidity() && input.value !== "") read(); });
  }
  render();
})();
