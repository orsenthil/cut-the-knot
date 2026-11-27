"use strict";

/*
 * The page for Edge Illusion: drawing and input only. The rules are in
 * edge-illusion-core.js. The SVG field shows the applet's offscreen canvas at
 * the top (360 x 320 board units) and a ruler underneath for the Part scrollbar;
 * the ruler's dot is draggable and also moves with the arrow keys. Sliders,
 * buttons and the two checkboxes set the other options. Nothing is won or lost:
 * the status line describes the picture and marks a demo explored.
 */

(function () {
  const Core = EdgeIllusionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");

  const nInput = document.getElementById("nInput");
  const partInput = document.getElementById("partInput");
  const nOut = document.getElementById("nOut");
  const partOut = document.getElementById("partOut");
  const triangleBtn = document.getElementById("triangleBtn");
  const squareBtn = document.getElementById("squareBtn");
  const modeBtns = {
    plain: document.getElementById("modePlain"),
    edges: document.getElementById("modeEdges"),
    fill: document.getElementById("modeFill"),
    paint: document.getElementById("modePaint"),
  };
  const switchBtn = document.getElementById("switchBtn");
  const extraBtn = document.getElementById("extraBtn");
  const lessN = document.getElementById("lessN");
  const moreN = document.getElementById("moreN");
  const lessPart = document.getElementById("lessPart");
  const morePart = document.getElementById("morePart");
  const resetBtn = document.getElementById("resetBtn");

  const fieldLayer = board.layer("field");
  const ringLayer = board.layer("rings");
  const maskLayer = board.layer("mask");
  const edgeLayer = board.layer("edges");
  const extraLayer = board.layer("extras");
  const rulerLayer = board.layer("ruler");
  const handleLayer = board.layer("handles");

  const RULER_Y = 350;
  const RULER_X0 = 20;
  const RULER_X1 = 340;
  const partPoint = (part) => ({ x: RULER_X0 + ((RULER_X1 - RULER_X0) * part) / 100, y: RULER_Y });
  const partFromX = (x) => Core.clampPart(Math.round(((x - RULER_X0) * 100) / (RULER_X1 - RULER_X0)));

  /** A Geom-style wrapper for markup Geom has no helper for (rects). */
  function shapeEl(tag, cls, layer) {
    const node = board.el(tag, null, cls, layer);
    return {
      node: node,
      set: function (attrs) {
        for (const k in attrs) node.setAttribute(k, attrs[k]);
        return this;
      },
      show: function (on) { node.style.display = on ? "" : "none"; return this; },
    };
  }

  const field = shapeEl("rect", "field", fieldLayer);
  const frame = shapeEl("rect", "frame", fieldLayer);

  const MAX_CORNERS = 4;
  const MAX_RINGS = MAX_CORNERS * (2 * Core.MAX_N - 1);
  const MAX_STROKES = MAX_CORNERS * 2 * Core.MAX_N;
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i++) rings.push(board.circle({ x: 0, y: 0 }, 0, "pac", ringLayer));
  const mask = board.polygon([{ x: 0, y: 0 }], "mask", maskLayer);
  const strokes = [];
  for (let i = 0; i < MAX_STROKES; i++) {
    strokes.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "edge-stroke", edgeLayer));
  }
  const extraFills = [];
  const extraSides = [];
  const extraBases = [];
  for (let i = 0; i < MAX_CORNERS; i++) {
    extraFills.push(board.polygon([{ x: 0, y: 0 }], "extra-fill", extraLayer));
    extraSides.push([
      board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "extra-line", extraLayer),
      board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "extra-line", extraLayer),
    ]);
    extraBases.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "extra-base", extraLayer));
  }

  const rulerLine = board.segment({ x: RULER_X0, y: RULER_Y }, { x: RULER_X1, y: RULER_Y }, "ruler-line", rulerLayer);
  const rulerTicks = [0, 25, 50, 75, 100].map((v) =>
    board.segment(partPoint(v), { x: partPoint(v).x, y: RULER_Y + 6 }, "ruler-tick", rulerLayer));
  const rulerLabels = [0, 50, 100].map((v) =>
    board.label(partPoint(v), String(v), "ruler-label", 0, 19, rulerLayer));

  let state = Core.start();
  const seen = {
    shapes: new Set(), modes: new Set(), colours: new Set(), extras: new Set(),
  };

  /**
   * `kind` is "done" once the player has tried both shapes, all four drawing
   * modes, both colour schemes and both extra-shape settings. That is how an
   * explored illustration finishes; "win" and "lose" are never used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const picture = Core.scene(state);
    const g = picture.layout;
    board.root.classList.toggle("switched", state.swapped);

    field.set(picture.field);
    frame.set(picture.frame);
    mask.set(picture.mask);

    rings.forEach((ring, i) => {
      const c = picture.circles[i];
      ring.show(!!c);
      if (!c) return;
      ring.set({ x: c.x, y: c.y }, c.r);
      ring.node.setAttribute("class", "pac " + (c.filled ? "filled " : "outlined ") + c.colour);
    });

    strokes.forEach((line, i) => {
      const e = picture.edges[i];
      line.show(!!e);
      if (e) line.set({ x: e.x1, y: e.y1 }, { x: e.x2, y: e.y2 });
    });

    extraFills.forEach((poly, i) => {
      const x = picture.extras[i];
      poly.show(!!x && x.filled);
      if (x && x.filled) {
        poly.set([x.a, x.apex, x.b]);
        poly.node.setAttribute("class", "extra-fill " + x.colour);
      }
    });
    extraSides.forEach((pair, i) => {
      const x = picture.extras[i];
      pair.forEach((line, k) => {
        line.show(!!x && !x.filled);
        if (x && !x.filled) {
          line.set(k === 0 ? x.a : x.apex, k === 0 ? x.apex : x.b);
          line.node.setAttribute("class", "extra-line " + x.colour);
        }
      });
    });
    extraBases.forEach((line, i) => {
      const x = picture.extras[i];
      line.show(!!x && !!x.base);
      if (x && x.base) line.set(x.a, x.b);
    });

    hPart.set(partPoint(state.part));
    rulerLine.set({ x: RULER_X0, y: RULER_Y }, { x: RULER_X1, y: RULER_Y });
    rulerTicks.forEach((tick, i) => {
      const x = partPoint([0, 25, 50, 75, 100][i]).x;
      tick.set({ x: x, y: RULER_Y }, { x: x, y: RULER_Y + 6 });
    });
    rulerLabels.forEach((label, i) => label.set(partPoint([0, 50, 100][i])));

    if (String(nInput.value) !== String(state.n)) nInput.value = String(state.n);
    if (String(partInput.value) !== String(state.part)) partInput.value = String(state.part);
    switchBtn.checked = state.swapped;
    extraBtn.checked = state.extra;
    triangleBtn.setAttribute("aria-pressed", String(state.which === Core.TRIANGLE));
    squareBtn.setAttribute("aria-pressed", String(state.which === Core.SQUARE));
    for (const mode of Core.MODES) modeBtns[mode].setAttribute("aria-pressed", String(state.mode === mode));
    nOut.textContent = String(state.n);
    partOut.textContent = `${state.part}%`;
    lessN.disabled = state.n <= Core.MIN_N;
    moreN.disabled = state.n >= Core.MAX_N;
    lessPart.disabled = state.part <= Core.MIN_PART;
    morePart.disabled = state.part >= Core.MAX_PART;
    lessN.setAttribute("aria-label", `Use fewer circles, from ${state.n}`);
    moreN.setAttribute("aria-label", `Use more circles, from ${state.n}`);
    lessPart.setAttribute("aria-label", `Fill less of each circle, from ${state.part} percent`);
    morePart.setAttribute("aria-label", `Fill more of each circle, from ${state.part} percent`);

    seen.shapes.add(state.which);
    seen.modes.add(state.mode);
    seen.colours.add(state.swapped ? "swapped" : "normal");
    seen.extras.add(state.extra);
    const explored = seen.shapes.size === 2 && seen.modes.size === Core.MODES.length &&
      seen.colours.size === 2 && seen.extras.size === 2;

    const shape = state.which === Core.TRIANGLE ? "Triangle" : "Square";
    const corners = picture.mask.length;
    let text = `${shape}: ${corners} corners with ${g.n} shrinking circles each, step ${g.step.toFixed(2)} units. `;
    if (state.mode === "plain") text += "No sides are drawn; the middle is painted with the background colour.";
    else if (state.mode === "edges") text += `Show edges adds ${picture.edges.length} short strokes along the missing sides.`;
    else if (state.mode === "fill") text += "Every other circle is filled, so the corner pieces alternate with the background.";
    else text += "The filled circles cycle through the seven paint colours.";
    if (state.extra) text += " Extra shapes are on.";
    if (state.swapped) text += " The two colours are switched.";
    if (explored) text += " You have tried every way of drawing this shape.";
    say(text, explored ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function setOption(key, value) {
    state = Core.withOption(state, key, value);
    render();
  }

  const hPart = board.handle("Fill", partPoint(state.part), {
    r: 12,
    step: (RULER_X1 - RULER_X0) / 100,
    shift: 16,
    cls: "geom-handle fill-handle",
    layer: handleLayer,
    label: "Fill handle. Drag along the ruler, or focus it and use the arrow keys, to set how much of each circle you see, from 0 to 100 percent",
    describe: (q) => `at ${partFromX(q.x)} percent`,
    clamp: (q) => ({ x: Geom.clamp(q.x, RULER_X0, RULER_X1), y: RULER_Y }),
    onMove: (q) => setOption("part", partFromX(q.x)),
  });

  nInput.addEventListener("input", () => setOption("n", Number(nInput.value)));
  partInput.addEventListener("input", () => setOption("part", Number(partInput.value)));
  triangleBtn.addEventListener("click", () => setOption("which", Core.TRIANGLE));
  squareBtn.addEventListener("click", () => setOption("which", Core.SQUARE));
  for (const mode of Core.MODES) {
    modeBtns[mode].addEventListener("click", () => setOption("mode", mode));
  }
  switchBtn.addEventListener("change", () => setOption("swapped", switchBtn.checked));
  extraBtn.addEventListener("change", () => setOption("extra", extraBtn.checked));
  lessN.addEventListener("click", () => setOption("n", state.n - 1));
  moreN.addEventListener("click", () => setOption("n", state.n + 1));
  lessPart.addEventListener("click", () => setOption("part", state.part - 1));
  morePart.addEventListener("click", () => setOption("part", state.part + 1));
  function reset() {
    state = Core.start({ width: state.width, height: state.height });
    render();
    hPart.node.focus();
  }
  resetBtn.addEventListener("click", reset);

  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "[" || k === ",") { e.preventDefault(); setOption("n", state.n - 1); }
    else if (k === "]" || k === ".") { e.preventDefault(); setOption("n", state.n + 1); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); setOption("part", state.part - 1); }
    else if (e.key === "+" || e.key === "=") { e.preventDefault(); setOption("part", state.part + 1); }
    else if (k === "s") { e.preventDefault(); setOption("swapped", !state.swapped); }
    else if (k === "x") { e.preventDefault(); setOption("extra", !state.extra); }
    else if (k === "t") { e.preventDefault(); setOption("which", state.which === Core.TRIANGLE ? Core.SQUARE : Core.TRIANGLE); }
    else if (k === "m") {
      e.preventDefault();
      setOption("mode", Core.MODES[(Core.MODES.indexOf(state.mode) + 1) % Core.MODES.length]);
    } else if (k === "r") { e.preventDefault(); reset(); }
  });

  board.onTheme(render);
  render();
})();
