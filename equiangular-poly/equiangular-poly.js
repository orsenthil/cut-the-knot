"use strict";

/*
 * The page for Equiangular Poly: drawing and input only. All the geometry is
 * in equiangular-poly-core.js. The SVG holds the N side lines of the polygon
 * (drawn through their intersections), a draggable blue point P, one handle
 * per side line, and — with "Show hint" ticked — the comparison regular
 * polygon and the feet of the perpendiculars from P. Every SVG element is
 * created once at the largest option and re-set on each redraw, so dragging
 * or changing N never takes keyboard focus off a handle.
 */

(function () {
  const Core = EquiangularPolyCore;
  const statusEl = document.getElementById("status");
  const nRange = document.getElementById("nRange");
  const nValue = document.getElementById("nValue");
  const hintBox = document.getElementById("hintBox");

  const board = Geom.board("board");
  const layers = {
    hint: board.layer("hint"),
    fill: board.layer("fill"),
    sides: board.layer("sides"),
    altitudes: board.layer("altitudes"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start({});
  let geometry = Core.compute(state);

  /** Say what the picture shows. This is a demo: there is no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Allocated once at N = 15, then shown only as far as the current N needs.
  const sides = [], hintSides = [], spokes = [], altitudes = [], footDots = [];
  const lineHandles = [];
  const fill = board.polygon([state.P, state.P, state.P], "poly-fill", layers.fill);
  const pLabel = board.label(state.P, "P", "point-label", 12, -12, layers.labels);
  for (let i = 0; i < Core.MAX_N; i++) {
    sides.push(board.segment(state.P, state.P, "poly-side", layers.sides));
    hintSides.push(board.segment(state.P, state.P, "hint-side", layers.hint));
    spokes.push(board.segment(state.P, state.P, "hint-spoke", layers.hint));
    altitudes.push(board.segment(state.P, state.P, "altitude", layers.altitudes));
    footDots.push(board.point(state.P, "footdot", 3, layers.dots));
    const n = Core.start({ N: 3 }).lines[i % 3].n;
    const handle = board.handle("S" + i, { x: 200 + n.x * 90, y: 180 + n.y * 90 }, {
      r: 9,
      step: 4,
      cls: "geom-handle side-handle",
      layer: layers.handles,
      label: "Side " + (i + 1) + " line. Drag it, or focus it and press the arrow keys, " +
        "to slide the line parallel to itself.",
      describe: () => (state.lines[i]
        ? "distance from the centre " + Math.round(state.lines[i].t) + "."
        : "hidden."),
      clamp: (q) => {
        const c = Core.centreOf(state);
        const line = state.lines[i];
        const r = Math.min(state.width, state.height) / 4;
        const t = Math.max(0.4 * r, Math.min(1.6 * r,
          Core.dot(Core.sub(q, c), line.n)));
        return Core.add(c, Core.mul(line.n, t));
      },
      onMove: (q) => apply({ type: "line", index: i, point: q }),
    });
    lineHandles.push(handle);
  }
  const pHandle = board.handle("P", state.P, {
    r: 10,
    step: 4,
    cls: "geom-handle point-handle",
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
    fill.set(g.V.slice(0, N)).show(g.convex);
    pLabel.set(g.P);
    for (let i = 0; i < Core.MAX_N; i++) {
      const on = i < N;
      const j = (i + 1) % N;
      const a = on ? g.V[i] : g.P, b = on ? g.V[j] : g.P;
      const u = on ? g.U[i] : g.P, v = on ? g.U[j] : g.P;
      const foot = on ? (state.showHint ? g.feet[i] : g.F[i]) : g.P;
      sides[i].set(a, b).show(on);
      hintSides[i].set(u, v).show(on && state.showHint);
      spokes[i].set(g.P, u).show(on && state.showHint);
      altitudes[i].set(g.P, foot).show(on);
      footDots[i].set(foot).show(on);
      const c = Core.centreOf(state);
      const line = on ? state.lines[i] : { n: { x: 1, y: 0 }, t: 0 };
      lineHandles[i].set(Core.add(c, Core.mul(line.n, line.t))).show(on);
    }
    pHandle.set(g.P);
  }

  function statusText(g) {
    const sum = g.sumSigned.toFixed(1);
    let text = g.N + " sides. Distances from P to the side lines add to " + sum + " — " +
      "moving P does not change it.";
    if (!g.inside) {
      text += " P is outside, so the ordinary distances differ from this signed sum.";
    }
    if (!g.convex) {
      text += " The side lines now fold over; press Reset for a simple polygon.";
    }
    if (state.showHint) {
      text += " The dashed regular polygon sits 2 units outside the longest side.";
    }
    return text;
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
    apply({ type: "point", point: Core.centreOf(state) }));
  document.getElementById("resetBtn").addEventListener("click", () =>
    apply({ type: "reset" }));

  // The colours are CSS custom properties, so a theme flip needs no new art.
  board.onTheme(() => draw());

  render();
})();
