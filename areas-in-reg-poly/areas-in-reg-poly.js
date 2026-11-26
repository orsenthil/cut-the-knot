"use strict";

/*
 * The page for Areas In Reg Poly: drawing and input only. All the geometry
 * lives in areas-in-reg-poly-core.js. The SVG holds a regular 2n-gon, the 2n
 * triangles cut out by joining a draggable point P to its vertices, and,
 * when "Show hint" is ticked, the two extended n-gons and the altitudes from
 * P to the sides. Every shape is created once and re-set on each redraw, so
 * changing N or dragging P never takes keyboard focus off the P handle.
 */

(function () {
  const Core = AreasInRegPolyCore;
  const statusEl = document.getElementById("status");
  const nRange = document.getElementById("nRange");
  const nValue = document.getElementById("nValue");
  const hintBox = document.getElementById("hintBox");
  const board = Geom.board("board");

  // Paint order follows the applet: hint n-gons first, then the coloured
  // triangles, the polygon, the altitudes, dots, labels and the draggable P.
  const layers = {
    hint: board.layer("hint"),
    fills: board.layer("fills"),
    sides: board.layer("sides"),
    spokes: board.layer("spokes"),
    altitudes: board.layer("altitudes"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start({});
  let geometry = Core.compute(state);

  /** Say what the picture shows. A demo has no winner: no win/lose class. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Allocated once at the largest option, then shown only as far as N needs.
  const triangles = [], sides = [], spokes = [], altitudes = [], feet = [];
  const uLines = [], wLines = [];
  for (let i = 0; i < Core.MAX_N; i++) {
    triangles.push(board.polygon([state.P, state.P, state.P],
      i % 2 === 0 ? "tri tri-even" : "tri tri-odd", layers.fills));
    sides.push(board.segment(state.P, state.P, "poly-side", layers.sides));
    spokes.push(board.segment(state.P, state.P, "spoke", layers.spokes));
    altitudes.push(board.segment(state.P, state.P,
      i % 2 === 0 ? "altitude altitude-even" : "altitude altitude-odd", layers.altitudes));
    feet.push(board.point(state.P, "footdot", 3, layers.dots));
  }
  for (let i = 0; i < Core.MAX_N / 2; i++) {
    uLines.push(board.segment(state.P, state.P, "hint-u", layers.hint));
    wLines.push(board.segment(state.P, state.P, "hint-w", layers.hint));
  }
  const pLabel = board.label(state.P, "P", "point-label", 11, -11, layers.labels);
  const pHandle = board.handle("P", state.P, {
    r: 10,
    step: 4,
    cls: "geom-handle",
    layer: layers.handles,
    label: "Point P. Drag it, or focus it and use the arrow keys to move it.",
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
    clamp: (q) => ({
      x: Math.max(8, Math.min(state.width - 8, q.x)),
      y: Math.max(8, Math.min(state.height - 8, q.y)),
    }),
    onMove: (p) => apply({ type: "point", point: p }),
  });

  function draw() {
    const g = geometry;
    const N = g.N;
    for (let i = 0; i < Core.MAX_N; i++) {
      const j = (i + 1) % N;
      const on = i < N;
      const a = on ? g.V[i] : g.P, b = on ? g.V[j] : g.P;
      const h = on ? g.H[i] : g.P;
      triangles[i].set([a, b, g.P]).show(on);
      sides[i].set(a, b).show(on);
      spokes[i].set(a, g.P).show(on);
      altitudes[i].set(g.P, h).show(on && state.showHint);
      feet[i].set(h).show(on && state.showHint);
    }
    for (let i = 0; i < Core.MAX_N / 2; i++) {
      const j = (i + 1) % g.n;
      const u = g.U[i], v = g.U[j];
      const w = g.W[i], x = g.W[j];
      uLines[i].set(u && v ? u : g.P, u && v ? v : g.P).show(state.showHint && i < g.n && !!u && !!v);
      wLines[i].set(w && x ? w : g.P, w && x ? x : g.P).show(state.showHint && i < g.n && !!w && !!x);
    }
    pHandle.set(g.P);
    pLabel.set(g.P);
  }

  function statusText(g) {
    const even = Math.round(g.evenArea);
    const odd = Math.round(g.oddArea);
    if (g.inside) {
      return `${g.N} sides. Even triangles add to ${even}, odd triangles add to ${odd} — ` +
        `equal, and each is half the polygon (${Math.round(g.polygonArea / 2)}).`;
    }
    return `${g.N} sides. Even triangles add to ${even}, odd triangles add to ${odd}. ` +
      "P is outside the polygon, so the page's equal-sums claim does not apply; " +
      "the signed sums still agree.";
  }

  /** Redraw, speak the picture, and save the position for record and tutor. */
  function render() {
    geometry = Core.compute(state);
    draw();
    say(statusText(geometry));
    nValue.textContent = String(state.N);
    if (Number(nRange.value) !== state.N) nRange.value = String(state.N);
    if (hintBox.checked !== state.showHint) hintBox.checked = state.showHint;
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    return true;
  }

  nRange.addEventListener("input", () => apply({ type: "N", value: Number(nRange.value) }));
  hintBox.addEventListener("change", () =>
    apply({ type: "option", key: "showHint", value: hintBox.checked }));
  document.getElementById("centreBtn").addEventListener("click", () =>
    apply({ type: "point", point: { x: Math.floor(state.width / 2), y: Math.floor(state.height / 2) } }));
  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }));

  // Colours are CSS custom properties, so a theme flip needs no new colours.
  board.onTheme(() => draw());

  render();
})();
