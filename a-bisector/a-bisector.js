"use strict";

/*
 * The page for ABisector: drawing and input only; the mathematics is in
 * a-bisector-core.js. An SVG holds a triangle with three draggable corners,
 * the three angle bisectors, their feet, the incenter and its circle. Two more
 * draggable dots ride along the A and B bisectors, as in the applet; when one
 * reaches the incenter its circle touches all three sides.
 */

(function () {
  const Core = ABisectorCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const circlesBtn = document.getElementById("circlesBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start();
  let checked = false;
  let showCircles = true;

  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* The objects are made once and only their geometry changes on a redraw. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const bisectors = [
    board.segment(state.A, state.B, "bisector", shapes),
    board.segment(state.B, state.C, "bisector", shapes),
    board.segment(state.C, state.A, "bisector", shapes),
  ];
  const footDots = [
    board.point(state.B, "foot-dot", 3.5, marks),
    board.point(state.C, "foot-dot", 3.5, marks),
    board.point(state.A, "foot-dot", 3.5, marks),
  ];
  const arcPairs = [
    [board.angleArc(state.A, state.B, state.C, 25, "half-arc", marks),
     board.angleArc(state.A, state.C, state.B, 25, "half-arc alt", marks)],
    [board.angleArc(state.B, state.A, state.C, 21, "half-arc", marks),
     board.angleArc(state.B, state.C, state.A, 21, "half-arc alt", marks)],
    [board.angleArc(state.C, state.A, state.B, 17, "half-arc", marks),
     board.angleArc(state.C, state.B, state.A, 17, "half-arc alt", marks)],
  ];
  const incircle = board.circle(state.A, 1, "incircle", marks);
  const incenterDot = board.point(state.A, "incenter-dot", 5, marks);
  const incenterLabel = board.label(state.A, "I", "glabel center-label", 8, -8, marks);
  const tangentA = board.circle(state.A, 1, "tangent-circle", marks);
  const tangentB = board.circle(state.B, 1, "tangent-circle", marks);
  const labels = [
    board.label(state.A, "A", "glabel", -20, 24, marks),
    board.label(state.B, "B", "glabel", -20, -10, marks),
    board.label(state.C, "C", "glabel", 10, 6, marks),
  ];

  /**
   * Shows the status line. `kind` is "done" when a claim has been checked, or
   * nothing while the player is exploring; the shared record reads the class.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const A = state.A, B = state.B, Cc = state.C;

    sides[0].set(A, B);
    sides[1].set(B, Cc);
    sides[2].set(Cc, A);

    const feet = [m.feet.D, m.feet.E, m.feet.F];
    for (let i = 0; i < 3; i++) {
      const vertex = [A, B, Cc][i];
      const foot = feet[i];
      bisectors[i].show(Boolean(foot));
      footDots[i].show(Boolean(foot));
      if (foot) {
        bisectors[i].set(vertex, foot);
        footDots[i].set(foot);
      }
      const other = i === 0 ? [B, Cc] : i === 1 ? [A, Cc] : [A, B];
      arcPairs[i][0].set(vertex, other[0], foot || other[0], 25 - 4 * i);
      arcPairs[i][1].set(vertex, foot || other[0], other[1], 25 - 4 * i);
      arcPairs[i][0].show(Boolean(foot));
      arcPairs[i][1].show(Boolean(foot));
    }
    labels[0].set(A);
    labels[1].set(B);
    labels[2].set(Cc);

    const hasCenter = !m.degenerate && m.incenter;
    incircle.show(Boolean(hasCenter));
    incenterDot.show(Boolean(hasCenter));
    incenterLabel.show(Boolean(hasCenter));
    tangentA.show(Boolean(hasCenter) && showCircles);
    tangentB.show(Boolean(hasCenter) && showCircles);
    if (hasCenter) {
      incircle.set(m.incenter, m.inradius);
      incenterDot.set(m.incenter);
      incenterLabel.set(m.incenter);
      const rA = Core.distToLine(state.Ca, A, B);
      const rB = Core.distToLine(state.Cb, A, B);
      tangentA.set(state.Ca, rA);
      tangentB.set(state.Cb, rB);
      const near = Math.min(
        Math.hypot(state.Ca.x - m.incenter.x, state.Ca.y - m.incenter.y),
        Math.hypot(state.Cb.x - m.incenter.x, state.Cb.y - m.incenter.y),
      );
      if (near < 0.6) checked = true;
    }

    if (m.degenerate) {
      say("Move the corners apart to make a triangle.", null);
    } else if (checked) {
      say("All three bisectors meet at the incenter; its circle touches every side.", "done");
    } else {
      say(`AB/AC = ${fmt(m.ratios.AB_AC)} and BD/DC = ${fmt(m.ratios.BD_DC)}. Drag a corner, or press Check the claims.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  function resetAux() {
    const m = Core.measurements(state);
    state.Ca = m.feet.D ? Geom.midpoint(state.A, m.feet.D) : { ...state.A };
    state.Cb = m.feet.E ? Geom.midpoint(state.B, m.feet.E) : { ...state.B };
    if (hCa) hCa.set(state.Ca);
    if (hCb) hCb.set(state.Cb);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    resetAux();
    render();
  }

  const clampVertex = (p) => inside(p);
  const clampAlong = (p, from, to) =>
    Core.projectOnSegment(inside(p), from, to || from);

  const hA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner A. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner B. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner C. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex("C", p),
  });
  let hCa, hCb;

  resetAux();
  hCa = board.handle("Ca", state.Ca, {
    r: 7, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    label: "Point on the A bisector. Drag toward the incenter, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => clampAlong(p, state.A, Core.bisectorFoot(state, "A")),
    onMove: (p) => { state.Ca = { x: p.x, y: p.y }; render(); },
  });
  hCb = board.handle("Cb", state.Cb, {
    r: 7, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    label: "Point on the B bisector. Drag toward the incenter, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    clamp: (p) => clampAlong(p, state.B, Core.bisectorFoot(state, "B")),
    onMove: (p) => { state.Cb = { x: p.x, y: p.y }; render(); },
  });

  function newGame() {
    state = Core.start();
    checked = false;
    resetAux();
    render();
    hA.node.focus();
  }

  function checkClaims() {
    const all = Core.claims(state);
    const pass = Object.values(all).every(Boolean);
    checked = pass;
    render();
    if (!pass) say("Move the corners apart, then check again.", null);
  }

  newBtn.addEventListener("click", newGame);
  circlesBtn.addEventListener("click", () => {
    showCircles = !showCircles;
    circlesBtn.setAttribute("aria-pressed", String(showCircles));
    circlesBtn.textContent = showCircles ? "Hide tangent circles" : "Show tangent circles";
    render();
  });
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
