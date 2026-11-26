"use strict";

/*
 * The page for Angle Bisector: drawing and input only; the construction and
 * its claims live in angle-bisector-core.js. The SVG holds the two rays at A,
 * the red circle that copies AD onto AC, the two equal circles at D and E,
 * their crossing F and the bisector through A. A, B, C, D and R are draggable
 * (and arrow-key movable); the buttons check the claims and switch the hint.
 */

(function () {
  const Core = AngleBisectorCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const hintBtn = document.getElementById("hintBtn");
  const namesBtn = document.getElementById("namesBtn");
  const euclidBtn = document.getElementById("euclidBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  const deg = (v) => (Number.isFinite(v) ? (v * 180 / Math.PI).toFixed(1) + "°" : "—");

  let state = Core.start();
  let checked = false;
  let showHint = false;
  let showNames = true;

  /* Layers in paint order: guides, circles, rays, hint, bisector, marks, text,
     handles. Elements are made once and only their geometry changes. */
  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const rays = board.layer("rays");
  const hints = board.layer("hints");
  const bisectors = board.layer("bisectors");
  const marks = board.layer("marks");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const circleA = board.circle(state.A, 1, "circle-a", circles);
  const circleD = board.circle(state.A, 1, "circle-two", circles);
  const circleE = board.circle(state.A, 1, "circle-two", circles);
  const rayAB = board.line(state.A, state.B, "ray", rays);
  const rayAC = board.line(state.A, state.C, "ray", rays);
  const radiusLine = board.segment(state.A, state.R, "radius-guide", hints);
  const hintEdges = [
    board.line(state.A, state.B, "hint-edge", hints),
    board.line(state.A, state.B, "hint-edge", hints),
    board.line(state.A, state.B, "hint-edge", hints),
    board.line(state.A, state.B, "hint-edge", hints),
  ];
  const bisector = board.line(state.A, state.B, "bisector", bisectors);
  const dotD = board.point(state.A, "construction-dot", 3.5, marks);
  const dotE = board.point(state.A, "construction-dot", 3.5, marks);
  const dotsP = [
    board.point(state.A, "intersection-dot", 4, marks),
    board.point(state.A, "intersection-dot", 4, marks),
  ];
  const arc1 = board.angleArc(state.A, state.B, state.C, 26, "half-angle", marks);
  const arc2 = board.angleArc(state.A, state.C, state.B, 26, "half-angle alt", marks);
  const names = {
    A: board.label(state.A, "A", "pt-label", -20, 24, text),
    B: board.label(state.B, "B", "pt-label", 8, -10, text),
    C: board.label(state.C, "C", "pt-label", 8, -10, text),
    D: board.label(state.A, "D", "pt-label small", -18, -10, text),
    E: board.label(state.A, "E", "pt-label small", 8, -10, text),
    F: board.label(state.A, "F", "pt-label small", 8, -10, text),
    R: board.label(state.R, "R", "pt-label small", 8, 18, text),
  };

  /**
   * The line under the game. "done" marks a finished check for the player's
   * record (assets/progress.js); an illustration has no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.construction(state);
    const m = Core.measurements(state);

    circleA.set(state.A, c.AD);
    rayAB.set(state.A, state.B);
    rayAC.set(state.A, state.C);
    radiusLine.set(c.D, state.R);
    dotD.set(c.D);

    const ready = c.ok && c.F && c.P.length === 2;
    circleD.show(c.ok);
    circleE.show(c.ok);
    dotE.show(c.ok);
    dotD.show(c.ok);
    radiusLine.show(c.ok);
    if (c.ok) {
      circleD.set(c.D, c.radius);
      circleE.set(c.E, c.radius);
      dotE.set(c.E);
    }

    for (let i = 0; i < 2; i++) {
      dotsP[i].show(Boolean(c.P[i]));
      if (c.P[i]) dotsP[i].set(c.P[i]);
    }

    const end = c.F || c.P[0];
    bisector.show(Boolean(end));
    if (end) bisector.set(state.A, end);
    arc1.show(Boolean(ready));
    arc2.show(Boolean(ready));
    if (ready) {
      arc1.set(state.A, c.D, c.F, 26);
      arc2.set(state.A, c.F, state.C, 26);
    }

    const edges = ready
      ? [[state.A, c.E], [state.A, c.D], [c.F, c.D], [c.F, c.E]]
      : [];
    for (let i = 0; i < hintEdges.length; i++) {
      hintEdges[i].show(showHint && Boolean(edges[i]));
      if (edges[i]) hintEdges[i].set(edges[i][0], edges[i][1]);
    }

    names.A.set(state.A, "A");
    names.B.set(state.B, "B");
    names.C.set(state.C, "C");
    names.D.set(c.D, "D");
    names.E.set(c.ok ? c.E : state.A, "E");
    names.F.set(c.F || state.A, "F");
    names.R.set(state.R, "R");
    for (const key in names) names[key].show(showNames && (key !== "F" || Boolean(c.F)));

    if (!c.ok) {
      say("Drag D away from A to rebuild the circles.");
    } else if (!c.F) {
      say(`The circles do not overlap yet: drag R outward (a radius over ${fmt(m.minRadius)} is enough).`);
    } else if (checked) {
      say(`Checked: the two angles are ${deg(m.leftAngle)} and ${deg(m.rightAngle)}; ` +
          `F is ${fmt(m.distToAB)} from each ray. AF bisects the angle.`, "done");
    } else {
      say(`AD = ${fmt(m.AD)}, AE = ${fmt(m.AE)}, DF = EF = ${fmt(c.radius)}. ` +
          `Drag R, or press Check the claims.`);
    }

    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampRay = (p) => inside(p);
  const clampD = (p) => {
    const q = inside(p);
    return Core.pointOn(state.A, state.B, Geom.clamp(Core.coef(state.B, q, state.A), -0.2, 1.2));
  };

  const handles = {
    A: board.handle("A", state.A, {
      r: 12, step: 3, shift: 12, layer: tops, clamp: clampRay,
      label: "Point A, the corner of the angle. Drag it, or focus it and use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 12, step: 3, shift: 12, layer: tops, clamp: clampRay,
      label: "Point B, first ray. Drag it, or focus it and use the arrow keys to turn the ray.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 12, step: 3, shift: 12, layer: tops, clamp: clampRay,
      label: "Point C, second ray. Drag it, or focus it and use the arrow keys to turn the ray.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("C", p),
    }),
    D: board.handle("D", Core.pointD(state), {
      r: 10, step: 3, shift: 12, cls: "geom-handle aux-handle", layer: tops,
      clamp: clampD,
      label: "Point D on the first ray. Drag along the ray to set AD, or use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("D", p),
    }),
    R: board.handle("R", state.R, {
      r: 10, step: 3, shift: 12, cls: "geom-handle aux-handle", layer: tops,
      clamp: clampRay,
      label: "Point R. Drag it away from D to enlarge both circles, or use the arrow keys.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("R", p),
    }),
  };

  function syncHandles() {
    const c = Core.construction(state);
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    handles.D.set(c.D);
    handles.R.set(state.R);
  }

  function reset() {
    state = Core.start();
    checked = false;
    syncHandles();
    render();
    handles.A.node.focus();
  }

  function checkClaims() {
    checked = Object.values(Core.claims(state)).every(Boolean);
    render();
    if (!checked) {
      const c = Core.construction(state);
      say(c.ok && !c.F
        ? "The circles do not overlap: drag R outward until they meet, then check again."
        : "Move the rays apart, then check again.");
    }
  }

  function toggleHint() {
    showHint = !showHint;
    hintBtn.setAttribute("aria-pressed", String(showHint));
    hintBtn.textContent = showHint ? "Hide hint" : "Show hint";
    render();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function useEuclidRadius() {
    state = Core.setRadius(state, Core.euclidRadius(state));
    checked = false;
    syncHandles();
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaims);
  hintBtn.addEventListener("click", toggleHint);
  namesBtn.addEventListener("click", toggleNames);
  euclidBtn.addEventListener("click", useEuclidRadius);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c") checkClaims();
    else if (k === "h") toggleHint();
    else if (k === "n") toggleNames();
    else if (k === "e") useEuclidRadius();
  });

  syncHandles();
  board.onTheme(render);
  render();
})();
