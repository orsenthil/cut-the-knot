"use strict";

/*
 * Circle Of Similitude — drawing and input only; all the geometry is in
 * circle-of-similitude-core.js. The stage holds an SVG board: two draggable
 * circles, their common tangents, the circle on the two centres of similarity,
 * and a point T that always stays on that circle. Red and orange rays from T
 * are the tangents whose lengths the theorem compares.
 */

(function () {
  const Core = CircleOfSimilitudeCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesEl = document.getElementById("names");
  const hintEl = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({ names: namesEl.checked, hint: hintEl.checked });

  /* Back to front: guides and tangent lines, the circles, the rays from T,
   * small dots and names, then the handles that keep keyboard focus. */
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const rays = board.layer("rays");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const baseline = board.line(state.C1, state.C2, "baseline", guides);
  const extLines = [board.line(state.C1, state.C2, "common-tangent", guides),
                    board.line(state.C1, state.C2, "common-tangent", guides)];
  const intLines = [board.line(state.C1, state.C2, "common-tangent", guides),
                    board.line(state.C1, state.C2, "common-tangent", guides)];
  const circle1 = board.circle(state.C1, 1, "circle-main", circles);
  const circle2 = board.circle(state.C2, 1, "circle-main", circles);
  const csCircle = board.circle(state.C1, 1, "circle-cs", circles);
  const bisector = board.line(state.C1, state.C2, "circle-cs", circles);
  const tRays = [0, 1, 2, 3].map(() => board.segment(state.T, state.C1, "t-ray", rays));
  const tanDots = [0, 1, 2, 3].map(() => board.point(state.T, "tan-dot", 3, dots));
  const pDot = board.point(state.C1, "centre-p", 4, dots);
  const qDot = board.point(state.C2, "centre-q", 4, dots);
  const angles = [0, 1].map(() => board.angleArc(state.T, state.C1, state.C2, 15, "angle", dots));

  const labels = {};
  for (const key of ["C1", "C2", "P", "Q", "T"]) {
    labels[key] = board.label(state.C1, key === "C1" ? "O₁" : key === "C2" ? "O₂" : key,
      "point-label", key === "Q" || key === "T" ? 8 : -15, key === "T" ? 19 : -10, names);
  }

  const handleOpts = {
    r: 9, step: 4, shift: 12, layer: top,
    clamp: (p) => Core.clamp(p),
    onMove: (p, name) => { state = Core.move(state, name, p); render(); },
  };
  const handles = {};
  const descriptions = {
    C1: "the centre of the first circle",
    R1: "the edge of the first circle, which sets its radius",
    C2: "the centre of the second circle",
    R2: "the edge of the second circle, which sets its radius",
    T: "a point that slides around the blue circle of similitude",
  };
  for (const key of ["C1", "R1", "C2", "R2", "T"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOpts, {
      label: `Point ${key}, ${descriptions[key]}. Drag it, or focus it and use the arrow keys.`,
    }));
  }

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    handles.C1.set(state.C1);
    handles.R1.set(state.R1);
    handles.C2.set(state.C2);
    handles.R2.set(state.R2);
    handles.T.set(state.T);

    const c1 = g ? g.C1 : state.C1, c2 = g ? g.C2 : state.C2;
    baseline.set(Core.point(0, c1.y), Core.point(Core.VIEW.width, c1.y));
    circle1.set(c1, g ? g.r1 : 1);
    circle2.set(c2, g ? g.r2 : 1);

    const lines = g ? g.tangents : { external: [], internal: [] };
    for (let i = 0; i < extLines.length; i++) {
      const line = lines.external[i];
      extLines[i].show(!!line);
      if (line) extLines[i].set(line[0], line[1]);
    }
    for (let i = 0; i < intLines.length; i++) {
      const line = lines.internal[i];
      intLines[i].show(!!line);
      if (line) intLines[i].set(line[0], line[1]);
    }

    if (g && g.valid && g.cs) {
      csCircle.set(g.cs.c, g.cs.r);
      csCircle.show(true);
      bisector.show(false);
    } else if (g && g.valid && g.line) {
      const n = g.line.n;
      const len = Math.hypot(n.x, n.y) || 1;
      const u = Core.point(-n.y / len * 400, n.x / len * 400);
      bisector.set(Core.sub(g.line.m, u), Core.add(g.line.m, u));
      bisector.show(true);
      csCircle.show(false);
    } else {
      csCircle.show(false);
      bisector.show(false);
    }

    const from1 = g && g.fromT1, from2 = g && g.fromT2;
    for (let i = 0; i < tRays.length; i++) {
      const pair = i < 2 ? from1 : from2;
      const p = pair && pair[i % 2];
      tRays[i].show(!!p);
      if (p) tRays[i].set(state.T, p);
      tanDots[i].show(!!p);
      if (p) tanDots[i].set(p);
    }

    const showP = !!(g && g.valid && g.P && state.options.names);
    const showQ = !!(g && g.valid && g.Q && state.options.names);
    pDot.show(showP);
    qDot.show(showQ);
    if (showP) pDot.set(g.P);
    if (showQ) qDot.set(g.Q);
    for (let i = 0; i < angles.length; i++) {
      const pair = i === 0 ? from1 : from2;
      angles[i].show(!!(state.options.hint && pair && pair.length === 2));
      if (pair && pair.length === 2) angles[i].set(state.T, pair[0], pair[1], 15);
    }

    labels.C1.show(state.options.names);
    labels.C2.show(state.options.names);
    labels.T.show(state.options.names);
    labels.P.show(showP);
    labels.Q.show(showQ);
    labels.C1.set(state.C1);
    labels.C2.set(state.C2);
    labels.T.set(state.T);
    labels.P.set(g && g.P ? g.P : state.C1);
    labels.Q.set(g && g.Q ? g.Q : state.C2);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  namesEl.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesEl.checked);
    render();
  });
  hintEl.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintEl.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesEl.checked = state.options.names;
    hintEl.checked = state.options.hint;
    render();
  });

  // SVG colours come from CSS classes, but keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
