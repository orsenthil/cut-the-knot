"use strict";

/*
 * Disappearing Rectangles - the page.
 *
 * The strip's arithmetic lives in vanishing-rectangles-core.js; this file
 * draws it and lets you slide the halves. As in the applet, each half can be
 * dragged left or right and wraps round the strip; the slots are 2W apart and
 * each rectangle is W wide. On release a half settles on the nearest slot, so
 * the rectangles line up cleanly (the applet only snapped when the two empty
 * pieces met). The arrow buttons slide a half by one slot. "Show units" draws
 * the unit lines on every piece, "Lighten the cut" makes the cut faint, and the
 * pieces between the two empty ones are tinted, as the applet did, so you can
 * follow where they travel.
 */

(() => {
  const V = VanishingRectanglesCore;

  const svg = document.getElementById("paper");
  const nInput = document.getElementById("nInput");
  const unitsInput = document.getElementById("unitsInput");
  const lightInput = document.getElementById("lightInput");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const countLine = document.getElementById("countLine");

  const SVG = "http://www.w3.org/2000/svg";
  const W = 18; // rectangle width; slots are 2W apart
  const HALF = 110; // height of each half

  let s = null;
  let off = { top: 0, bottom: 0 }; // in pixels, the strips' sideways positions
  let drag = null;

  const el = (name, attrs) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const width = () => s.n * 2 * W;
  const unit = () => HALF / s.n;
  const wrap = (x) => ((x % width()) + width()) % width();
  const shiftSlots = () => Math.round((off.top - off.bottom) / (2 * W));

  function tinted(i) {
    const [a, b] = [Math.min(s.upper0, s.lower0), Math.max(s.upper0, s.lower0)];
    return i > a && i < b;
  }

  function strip(which) {
    const g = el("g", { class: "strip", "data-strip": which });
    const yCut = 10 + HALF;
    g.appendChild(el("rect", { x: 0, y: which === "top" ? 10 : yCut, width: width(), height: HALF, fill: "transparent" }));
    for (let i = 0; i < s.n; i++) {
      const h = which === "top" ? V.top(s, i) : V.bottom(s, i);
      if (!h) continue;
      const x0 = wrap(W / 2 + i * 2 * W + off[which]);
      const y = which === "top" ? yCut - h * unit() : yCut;
      for (const x of [x0, x0 - width()]) {
        g.appendChild(el("rect", { x, y, width: W, height: h * unit(), class: "piece" + (tinted(i) ? " tinted" : "") }));
        if (unitsInput.checked) {
          for (let k = 1; k < h; k++) {
            const yy = which === "top" ? yCut - k * unit() : yCut + k * unit();
            g.appendChild(el("line", { x1: x, y1: yy, x2: x + W, y2: yy, class: "unit" }));
          }
        }
      }
    }
    return g;
  }

  function draw(settled = true) {
    const w = width();
    svg.setAttribute("viewBox", `0 0 ${w} ${2 * HALF + 20}`);
    svg.style.maxWidth = Math.max(260, w * 1.6) + "px";
    svg.replaceChildren();
    svg.appendChild(el("defs", {})).appendChild(el("clipPath", { id: "frame" })).appendChild(el("rect", { x: 0, y: 10, width: w, height: 2 * HALF }));
    svg.appendChild(el("rect", { x: 0, y: 10, width: w, height: 2 * HALF, class: "sheet" }));
    const inside = el("g", { "clip-path": "url(#frame)" });
    inside.appendChild(strip("top"));
    inside.appendChild(strip("bottom"));
    svg.appendChild(inside);
    svg.appendChild(el("line", { x1: 0, y1: 10 + HALF, x2: w, y2: 10 + HALF, class: "cut" + (lightInput.checked ? " light" : "") }));
    if (drag) svg.querySelector(`[data-strip="${drag.which}"]`).classList.add("dragging");
    countLine.textContent = `Number of rectangles: ${s.n}. How many do you see?`;
    if (!settled) return;
    const seen = V.visible(s, shiftSlots());
    if (seen < s.n) {
      statusEl.textContent = `Count them: there are only ${seen}. Where did one go?`;
      statusEl.className = "win";
    } else {
      statusEl.textContent = "";
      statusEl.className = "";
    }
  }

  function nudge(which, d) {
    off[which] += d * 2 * W;
    draw(true);
  }

  function reset() {
    s = V.start(Number(nInput.value));
    off = { top: 0, bottom: 0 };
    drag = null;
    draw(true);
  }

  for (let n = V.MIN_N; n <= V.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    if (n === V.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }
  nInput.addEventListener("change", reset);
  resetBtn.addEventListener("click", reset);
  unitsInput.addEventListener("change", () => draw(true));
  lightInput.addEventListener("change", () => draw(true));
  document.getElementById("topLeft").addEventListener("click", () => nudge("top", -1));
  document.getElementById("topRight").addEventListener("click", () => nudge("top", 1));
  document.getElementById("botLeft").addEventListener("click", () => nudge("bottom", -1));
  document.getElementById("botRight").addEventListener("click", () => nudge("bottom", 1));
  // Dragging: the svg itself holds the pointer (the strips are redrawn as they move),
  // and the pointer's height says which half was picked up.
  svg.addEventListener("pointerdown", (e) => {
    const r = svg.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * (2 * HALF + 20);
    drag = { which: y < 10 + HALF ? "top" : "bottom", x: e.clientX, start: 0 };
    drag.start = off[drag.which];
    svg.setPointerCapture(e.pointerId);
    draw(false);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const scale = width() / svg.getBoundingClientRect().width;
    off[drag.which] = drag.start + (e.clientX - drag.x) * scale;
    draw(false);
  });
  const release = () => {
    if (!drag) return;
    off[drag.which] = Math.round(off[drag.which] / (2 * W)) * 2 * W;
    drag = null;
    draw(true);
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);

  reset();
})();
