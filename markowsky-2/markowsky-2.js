"use strict";

/*
 * The page for Three Points on a Parabola: drawing and input only. The geometry
 * is in markowsky-2-core.js. The SVG holds the parabola and its axis, three
 * chords, the three lines AA'/BB'/CC', the orange lines PQ, PR, QR and (when
 * asked for) the three tangents and their meeting points. Three handles and
 * three sliders set the same parameters tA, tB, tC as the applet's scrollbars.
 */

(function () {
  const Core = Markowsky2Core;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const tangentsBtn = document.getElementById("tangentsBtn");
  const sliders = {
    A: document.getElementById("tA"),
    B: document.getElementById("tB"),
    C: document.getElementById("tC"),
  };
  const readouts = {
    A: document.getElementById("vA"),
    B: document.getElementById("vB"),
    C: document.getElementById("vC"),
  };
  const board = Geom.board(document.getElementById("board"));

  const baseLayer = board.layer("base");
  const guideLayer = board.layer("guides");
  const claimLayer = board.layer("claims");
  const tangentLayer = board.layer("tangents");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({});
  let shown = Core.compute(state, null);

  const axis = board.line({ x: 0, y: 0 }, { x: 0, y: 500 }, "axis-line", baseLayer);
  const directrix = board.line({ x: 0, y: 460 }, { x: 500, y: 460 }, "directrix", baseLayer);
  const curve = board.el("polyline", null, "parabola", baseLayer);
  const vertexDot = board.point({ x: 280, y: 420 }, "vertex-dot", 4, baseLayer);
  const focusDot = board.point({ x: 280, y: 380 }, "focus-dot", 4, baseLayer);
  const chords = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "chord", guideLayer));
  const verticals = [0, 1, 2].map(() =>
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "vertical", guideLayer));
  const claims = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "claim-line", claimLayer));
  const tangentLines = [0, 1, 2].map(() =>
    board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent-line", tangentLayer));

  const abcDots = ["A", "B", "C"].map(() => board.point({ x: 0, y: 0 }, "abc-dot", 5, dotLayer));
  const footDots = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "foot-dot", 3, dotLayer));
  const pqrDots = ["P", "Q", "R"].map(() => board.point({ x: 0, y: 0 }, "claim-dot", 5, dotLayer));
  const tangentDots = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "tangent-dot", 5, dotLayer));
  const abcLabels = ["A", "B", "C"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", 8, -8, labelLayer));
  const footLabels = ["A'", "B'", "C'"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", 8, -6, labelLayer));
  const pqrLabels = ["P", "Q", "R"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", -14, -9, labelLayer));
  const tangentLabels = ["M_A", "M_B", "M_C"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", -18, -9, labelLayer));

  /** Shows a line under the picture. There is no win and no loss here. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const ok = (p) => Core.finite(p);

  function setLine(shape, segment, on) {
    const visible = !!on && ok(segment.p) && ok(segment.q);
    if (visible) shape.set(segment.p, segment.q);
    shape.show(visible);
  }

  function setDot(shape, point, on) {
    const visible = !!on && ok(point);
    if (visible) shape.set(point);
    shape.show(visible);
  }

  function setLabel(shape, point, on) {
    const visible = !!on && ok(point);
    if (visible) shape.set(point);
    shape.show(visible);
  }

  /** The A, B, C handles slide along the same parabola and drive the sliders. */
  function onHandleMove(point, name) {
    const t = Math.round(point.x - Math.trunc(state.width / 2));
    state = Core.setT(state, name, t);
    sliders[name].value = String(state.t[name]);
    render();
  }

  function clampOnCurve(point) {
    const width = Math.trunc(state.width / 2);
    const t = Geom.clamp(Math.round(point.x - width), Core.MIN_T, Core.MAX_T);
    return Core.pointAt(state, t);
  }

  const handles = {
    A: board.handle("A", Core.pointAt(state, state.t.A), {
      r: 9, step: 1, shift: 10, layer: handleLayer, clamp: clampOnCurve, onMove: onHandleMove,
      label: "Point A on the parabola. Drag it along the curve, or focus it and use the left and right arrow keys",
    }),
    B: board.handle("B", Core.pointAt(state, state.t.B), {
      r: 9, step: 1, shift: 10, layer: handleLayer, clamp: clampOnCurve, onMove: onHandleMove,
      label: "Point B on the parabola. Drag it along the curve, or focus it and use the left and right arrow keys",
    }),
    C: board.handle("C", Core.pointAt(state, state.t.C), {
      r: 9, step: 1, shift: 10, layer: handleLayer, clamp: clampOnCurve, onMove: onHandleMove,
      label: "Point C on the parabola. Drag it along the curve, or focus it and use the left and right arrow keys",
    }),
  };

  /** How far the drawn (whole-pixel) answer is from the exact claim. */
  function deviations(d) {
    const { P, Q, R, MA, MB, MC } = d.points;
    if (![P, Q, R, MA, MB, MC].every(ok)) return null;
    const distance = (u, v, w) =>
      Math.abs((v.x - u.x) * (w.y - u.y) - (v.y - u.y) * (w.x - u.x)) /
      Math.hypot(v.x - u.x, v.y - u.y);
    const slopeError = (p, q, t) =>
      Math.abs((q.y - p.y) / (q.x - p.x) + t / (2 * Core.A));
    return {
      point: Math.max(distance(P, Q, MA), distance(P, R, MB), distance(Q, R, MC)),
      slope: Math.max(slopeError(P, Q, state.t.A), slopeError(P, R, state.t.B),
        slopeError(Q, R, state.t.C)),
    };
  }

  function render() {
    shown = Core.compute(state, shown);
    const p = shown.points;
    const names = state.options.names;
    const tangents = state.options.tangents;

    axis.set({ x: shown.axisX, y: 0 }, { x: shown.axisX, y: shown.height });
    directrix.set({ x: 0, y: shown.yDirectrix }, { x: shown.width, y: shown.yDirectrix });
    curve.setAttribute("points",
      shown.parabolaPoints.map((q) => q.x + "," + q.y).join(" "));
    setDot(vertexDot, { x: shown.axisX, y: shown.yVertex }, true);
    setDot(focusDot, { x: shown.axisX, y: shown.yFocus }, true);

    shown.chords.forEach((line, i) => setLine(chords[i], line, true));
    shown.verticals.forEach((line, i) => setLine(verticals[i], line, true));
    shown.pqr.forEach((line, i) => setLine(claims[i], line, true));
    shown.tangents.forEach((line, i) => setLine(tangentLines[i], line, tangents));

    [p.A, p.B, p.C].forEach((q, i) => setDot(abcDots[i], q, true));
    [p.A1, p.B1, p.C1].forEach((q, i) => setDot(footDots[i], q, names));
    [p.P, p.Q, p.R].forEach((q, i) => setDot(pqrDots[i], q, true));
    [p.MA, p.MB, p.MC].forEach((q, i) => setDot(tangentDots[i], q, tangents));

    [p.A, p.B, p.C].forEach((q, i) => setLabel(abcLabels[i], q, names));
    [p.A1, p.B1, p.C1].forEach((q, i) => setLabel(footLabels[i], q, names));
    [p.P, p.Q, p.R].forEach((q, i) => setLabel(pqrLabels[i], q, names));
    [p.MA, p.MB, p.MC].forEach((q, i) => setLabel(tangentLabels[i], q, names && tangents));

    for (const name of Object.keys(handles)) {
      handles[name].set(Core.pointAt(state, state.t[name]));
    }
    for (const name of Object.keys(sliders)) {
      if (Number(sliders[name].value) !== state.t[name]) {
        sliders[name].value = String(state.t[name]);
      }
      readouts[name].textContent = String(state.t[name]);
    }
    namesBtn.setAttribute("aria-pressed", String(names));
    tangentsBtn.setAttribute("aria-pressed", String(tangents));

    const error = shown.blocked ? null : deviations(shown);
    if (shown.blocked) {
      say("Two sliders match. The last drawing stays on screen, as in the applet.", null);
    } else if (!error) {
      say("Two lines are parallel here, so one point has gone off the board. Move a slider a little.", null);
    } else {
      const e = error;
      say("A at " + state.t.A + ", B at " + state.t.B + ", C at " + state.t.C +
        ". M_A is " + fmt(e.point) + " units from PQ, and PQ's slope differs from the tangent at A by " +
        fmt(e.slope) + ". The theorem is exact for a smooth parabola; the applet rounds points to whole pixels.", null);
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state, shown));
  }

  for (const name of Object.keys(sliders)) {
    sliders[name].addEventListener("input", () => {
      state = Core.setT(state, name, sliders[name].value);
      render();
    });
  }
  newBtn.addEventListener("click", () => {
    state = Core.reset(state);
    shown = Core.compute(state, null);
    render();
  });
  namesBtn.addEventListener("click", () => {
    state = Core.setOption(state, "names", !state.options.names);
    render();
  });
  tangentsBtn.addEventListener("click", () => {
    state = Core.setOption(state, "tangents", !state.options.tangents);
    render();
  });

  board.onTheme(() => render());
  render();
})();
