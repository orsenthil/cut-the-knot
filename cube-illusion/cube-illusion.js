"use strict";

/*
 * The page for Cube Illusion: drawing and input only; the geometry is in
 * cube-illusion-core.js. The SVG keeps the applet's view of one cube shape in
 * a fixed viewBox; a single affine group scales the original pixel geometry
 * into that box, so nothing is distorted when N or the tilt grows. The
 * dot on the small corner can be dragged or nudged with the arrow keys to
 * change M, just as the applet's M scrollbar does.
 */

(function () {
  const Core = CubeIllusionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const angleEl = document.getElementById("angle");
  const nEl = document.getElementById("nSize");
  const mEl = document.getElementById("mSize");
  const longEl = document.getElementById("longLines");
  const shortEl = document.getElementById("shortLines");
  const resetBtn = document.getElementById("resetBtn");
  const smallBtn = document.getElementById("showSmall");
  const cutBtn = document.getElementById("showCut");
  const sizeEl = document.getElementById("sizeReadout");

  const VIEW = { width: 400, height: 320 };
  const fit = board.el("g", { class: "fit-group" }, "geom-layer fit");
  const gridLayer = board.el("g", null, "geom-layer grid", fit);
  const edgeLayer = board.el("g", null, "geom-layer edges", fit);
  const handleLayer = board.el("g", null, "geom-layer handles", fit);

  const pools = { edge: [], long: [], short: [] };
  const seen = new Set();
  let endKind = null;
  let transform = { x: 0, y: 0, scale: 1 };
  let state = Core.start({});

  /** Says what the picture shows. "done" is the demo's finished marker. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function statusText() {
    const base = Core.describe(state);
    if (state.reading === "small") {
      return base + " Highlighted: a small cube standing in a tiled corner.";
    }
    if (state.reading === "cut") {
      return base + " Highlighted: a big cube with one corner cut away.";
    }
    return base + " Try both highlight buttons to swap the reading.";
  }

  function pool(kind, count) {
    const list = pools[kind];
    while (list.length < count) {
      const cls = kind === "edge" ? "ill-edge" : "ill-" + kind;
      list.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, cls, edgeLayer));
    }
    for (let i = 0; i < list.length; i++) list[i].show(i < count);
    return list;
  }

  /** Fit the original pixel geometry into the fixed viewBox, uniformly. */
  function fitDrawing(b) {
    const pad = 12;
    const scale = Math.min(
      (VIEW.width - 2 * pad) / Math.max(1, b.width),
      (VIEW.height - 2 * pad) / Math.max(1, b.height),
    );
    const x = VIEW.width / 2 - scale * (b.minX + b.maxX) / 2;
    const y = VIEW.height / 2 - scale * (b.minY + b.maxY) / 2;
    transform = { x, y, scale };
    fit.setAttribute("transform", `translate(${x} ${y}) scale(${scale})`);
  }

  function syncOptions() {
    angleEl.value = state.angle;
    nEl.value = state.n;
    mEl.value = state.m;
    longEl.checked = state.longLines;
    shortEl.checked = state.shortLines;
    sizeEl.textContent = `${state.angle}° · ${state.n} / ${state.m}`;
    smallBtn.setAttribute("aria-pressed", String(state.reading === "small"));
    cutBtn.setAttribute("aria-pressed", String(state.reading === "cut"));
  }

  /** The only place that paints: keep say() and Track.state() here. */
  function render() {
    const lines = Core.segments(state);
    fitDrawing(Core.bounds(state));
    const byKind = { edge: [], long: [], short: [] };
    for (const line of lines) byKind[line.kind].push(line);

    const edgeShapes = pool("edge", byKind.edge.length);
    byKind.edge.forEach((line, i) => {
      const shape = edgeShapes[i];
      shape.set(line.a, line.b);
      let cls = "ill-edge";
      if (state.reading === "small" && Core.READINGS.small.includes(line.name)) cls += " reading-small";
      if (state.reading === "cut" && Core.READINGS.cut.includes(line.name)) cls += " reading-cut";
      shape.node.setAttribute("class", cls);
    });
    for (const kind of ["long", "short"]) {
      const shapes = pool(kind, byKind[kind].length);
      byKind[kind].forEach((line, i) => shapes[i].set(line.a, line.b));
    }

    const p = Core.computePoints(state);
    handle.set(p.Bp);
    say(statusText(), endKind);
    if (window.Track) window.Track.state(state);
  }

  function change(patch) {
    state = Core.adjust(state, patch);
    syncOptions();
    render();
  }

  /* The small corner is a real drag handle; arrow keys nudge it by one unit. */
  function toCore(q) {
    return { x: (q.x - transform.x) / transform.scale, y: (q.y - transform.y) / transform.scale };
  }
  const handle = board.handle("Bp", Core.computePoints(state).Bp, {
    r: 9,
    step: 12,
    shift: 5,
    layer: handleLayer,
    label: "Small cube's upper corner. Drag it, or focus it and use the arrow keys, to resize the small corner.",
    describe: () => `Small corner ${state.m} of ${state.n} units.`,
    clamp: function (q) {
      const t = toCore(q);
      const p = Core.computePoints(state);
      const uw = p.slantedUnitW, uh = p.slantedUnitH;
      const raw = ((p.Cp.x - t.x) * uw + (p.Cp.y - t.y) * uh) / (uw * uw + uh * uh);
      const m = Math.max(Core.RANGES.m.min, Math.min(state.n, Math.round(raw)));
      return { x: p.Cp.x - m * uw, y: p.Cp.y - m * uh };
    },
    onMove: function (point) {
      const p = Core.computePoints(state);
      const uw = p.slantedUnitW, uh = p.slantedUnitH;
      const raw = ((p.Cp.x - point.x) * uw + (p.Cp.y - point.y) * uh) / (uw * uw + uh * uh);
      change({ m: Math.round(raw) });
    },
  });

  function chooseReading(kind) {
    state = { ...state, reading: state.reading === kind ? null : kind };
    if (state.reading) seen.add(state.reading);
    if (seen.size === 2) endKind = "done";
    syncOptions();
    render();
  }

  angleEl.addEventListener("input", () => change({ angle: Number(angleEl.value) }));
  nEl.addEventListener("input", () => change({ n: Number(nEl.value) }));
  mEl.addEventListener("input", () => change({ m: Number(mEl.value) }));
  longEl.addEventListener("change", () => change({ longLines: longEl.checked }));
  shortEl.addEventListener("change", () => change({ shortLines: shortEl.checked }));
  smallBtn.addEventListener("click", () => chooseReading("small"));
  cutBtn.addEventListener("click", () => chooseReading("cut"));
  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    seen.clear();
    endKind = null;
    syncOptions();
    render();
  });

  board.onTheme(() => render());
  syncOptions();
  render();
})();
