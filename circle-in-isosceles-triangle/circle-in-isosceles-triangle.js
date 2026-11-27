"use strict";

/*
 * The page for Circle In Isosceles Triangle: drawing and input only. The
 * geometry is in circle-in-isosceles-triangle-core.js.
 *
 * The SVG uses the applet's 400x300 coordinate space. Five handles can be
 * dragged or moved with the arrow keys: A slides along the symmetry axis, B
 * and C mirror each other, and P and Q share one parameter so AP = CQ stays
 * true. The circle through A, P and Q is drawn on every redraw; it always
 * passes through O, the circumcenter of ABC.
 */

(function () {
  const Core = CircleInIsoscelesTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const premiseBtn = document.getElementById("premiseBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const safeT = (t) => Geom.clamp(t, 0.04, 0.96);
  const along = (name, p) => {
    const from = name === "P" ? [state.B, state.A] : [state.A, state.C];
    const t = safeT(Core.tFromPoint(inside(p), from[0], from[1]));
    return Core.points({ ...state, t })[name];
  };

  let state = Core.start();
  let checked = false;
  let showNames = true;
  let showPremise = false;
  let showStatement = false;
  let showHint = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Each SVG object is made once and only its geometry changes on a redraw. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const apqCircle = board.circle(state.A, 1, "apq-circle", shapes);
  const radii = [
    board.line(state.A, state.B, "radius-line", guides),
    board.line(state.A, state.B, "radius-line", guides),
    board.line(state.A, state.B, "radius-line", guides),
  ];
  const hintLines = [
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
  ];
  const rightAngle = board.rightAngle(state.A, state.B, state.C, 10, "right-angle", guides);
  const footDot = board.point(state.A, "foot-dot", 3.5, marks);
  const ticks = [
    board.segment(state.A, state.B, "equal-tick", marks),
    board.segment(state.A, state.B, "equal-tick", marks),
  ];
  const centerDot = board.point(state.A, "center-dot", 5, marks);
  const labels = [
    board.label(state.A, "A", "glabel", -19, 23, marks),
    board.label(state.B, "B", "glabel", -19, -9, marks),
    board.label(state.C, "C", "glabel", 9, -9, marks),
    board.label(state.A, "P", "glabel point-label", -19, 22, marks),
    board.label(state.A, "Q", "glabel point-label", 9, -9, marks),
    board.label(state.A, "O", "glabel center-label", 9, -9, marks),
  ];

  /** A short mark across the middle of a segment, for equal lengths. */
  function tickEnds(p, q) {
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (-dy / len) * 7, oy = (dx / len) * 7;
    return [{ x: mx - ox, y: my - oy }, { x: mx + ox, y: my + oy }];
  }

  /** The status line; "done" marks a finished exploration, never a win/loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const { A, B, C, P, Q, O, foot } = m;
    const finiteO = O && Number.isFinite(O.x) && Number.isFinite(O.y);

    sides[0].set(A, B);
    sides[1].set(B, C);
    sides[2].set(C, A);

    apqCircle.show(Boolean(m.circle) && Number.isFinite(m.circle.radius));
    if (m.circle) apqCircle.set(m.circle.center, m.circle.radius);

    radii[0].set(A, O || A);
    radii[1].set(B, O || B);
    radii[2].set(C, O || C);
    for (const r of radii) r.show(showStatement && finiteO);

    hintLines[0].set(O || A, P);
    hintLines[1].set(O || A, Q);
    hintLines[2].set(A, foot);
    for (const h of hintLines) h.show(showHint && finiteO);
    rightAngle.show(showHint && finiteO);
    if (showHint && finiteO) rightAngle.set(foot, B, C, 10);
    footDot.show(showHint && finiteO);
    if (showHint && finiteO) footDot.set(foot);

    const t1 = tickEnds(A, P), t2 = tickEnds(C, Q);
    ticks[0].set(t1[0], t1[1]);
    ticks[1].set(t2[0], t2[1]);
    for (const tick of ticks) tick.show(showPremise);

    centerDot.show(finiteO);
    if (finiteO) centerDot.set(O);
    [A, B, C, P, Q, O || A].forEach((p, i) => labels[i].set(p));
    labels[3].set(P, showNames ? "P" : "");
    labels[4].set(Q, showNames ? "Q" : "");
    for (const label of labels) label.show(showNames);

    hA.set(A);
    hB.set(B);
    hC.set(C);
    hP.set(P);
    hQ.set(Q);

    if (m.degenerate) {
      say("Move the corners apart to make a triangle.", null);
    } else if (checked) {
      say("O is on the circle through A, P and Q. Drag any point and check another shape.", "done");
    } else {
      say("AP and CQ are equal. Does the circle through A, P and Q pass through O?", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampVertex = (p) => inside(p);
  const hA = board.handle("A", state.A, {
    r: 9, step: 3, shift: 12, layer: handlesLayer,
    clamp: (p) => ({ x: state.axis, y: clampVertex(p).y }),
    label: "Corner A. Drag, or focus it and use the arrow keys to move it up or down",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("A", p),
  });
  const hB = board.handle("B", state.B, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner B. Drag, or focus it and use the arrow keys; corner C mirrors it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("B", p),
  });
  const hC = board.handle("C", state.C, {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: "Corner C. Drag, or focus it and use the arrow keys; corner B mirrors it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("C", p),
  });
  const hP = board.handle("P", Core.points(state).P, {
    r: 8, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: (p) => along("P", p),
    label: "Point P on side AB. Drag, or focus it and use the arrow keys to slide it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("P", p),
  });
  const hQ = board.handle("Q", Core.points(state).Q, {
    r: 8, step: 2, shift: 8, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: (p) => along("Q", p),
    label: "Point Q on side AC. Drag, or focus it and use the arrow keys to slide it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move("Q", p),
  });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }

  function checkClaim() {
    checked = Object.values(Core.claims(state)).every(Boolean);
    render();
    if (!checked) say("Make a triangle with P and Q inside the equal sides, then check again.", null);
  }

  function toggle(btn, get, set, on, off) {
    const next = !get();
    set(next);
    btn.setAttribute("aria-pressed", String(next));
    btn.textContent = next ? off : on;
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, () => showNames, (v) => { showNames = v; }, "Show names", "Hide names"));
  premiseBtn.addEventListener("click", () =>
    toggle(premiseBtn, () => showPremise, (v) => { showPremise = v; }, "Show equal-length marks", "Hide equal-length marks"));
  statementBtn.addEventListener("click", () =>
    toggle(statementBtn, () => showStatement, (v) => { showStatement = v; }, "Show the three radii", "Hide the three radii"));
  hintBtn.addEventListener("click", () =>
    toggle(hintBtn, () => showHint, (v) => { showHint = v; }, "Show the hint", "Hide the hint"));
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") checkClaim();
  });

  board.onTheme(render);
  render();
})();
