"use strict";

/*
 * The page for Incircles Circumcircles: drawing and input only; all geometry
 * is in incircles-circumcircles-core.js. The SVG holds a triangle with three
 * draggable corners. Red bisectors from the corners meet at the incenter I.
 * Three optional circles pass through (I,A,B), (I,B,C) and (I,C,A); their
 * centers sit on the optional circumcircle of ABC. The three checkboxes copy
 * the applet's "Circumcircle ABC", "Incircle ABC" and "Circumcircles" options.
 */

(function () {
  const Core = IncirclesCircumcirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const toggles = {
    big: document.getElementById("showBig"),
    incircle: document.getElementById("showIncircle"),
    small: document.getElementById("showSmall"),
  };

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start();
  let checked = false;

  const fillLayer = board.layer("fill");
  const circleLayer = board.layer("circles");
  const lineLayer = board.layer("lines");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  /* Built once; a redraw only calls .set() and .show(), so focus stays put. */
  const triangle = board.polygon([state.A, state.B, state.C], "triangle-fill", fillLayer);
  const sides = [
    board.segment(state.A, state.B, "tri-side", fillLayer),
    board.segment(state.B, state.C, "tri-side", fillLayer),
    board.segment(state.C, state.A, "tri-side", fillLayer),
  ];
  const incircle = board.circle(state.A, 1, "incircle", circleLayer);
  const bigCircle = board.circle(state.A, 1, "circumcircle", circleLayer);
  const smallCircles = {
    A: board.circle(state.A, 1, "small-circle", circleLayer),
    B: board.circle(state.A, 1, "small-circle small-b", circleLayer),
    C: board.circle(state.A, 1, "small-circle small-c", circleLayer),
  };
  const bisectors = [
    board.line(state.A, state.B, "bisector", lineLayer),
    board.line(state.B, state.C, "bisector", lineLayer),
    board.line(state.C, state.A, "bisector", lineLayer),
  ];
  const iDot = board.point(state.A, "incenter-dot", 5, markLayer);
  const oDot = board.point(state.A, "big-center-dot", 5, markLayer);
  const centerDots = {
    A: board.point(state.A, "center-dot", 4, markLayer),
    B: board.point(state.A, "center-dot", 4, markLayer),
    C: board.point(state.A, "center-dot", 4, markLayer),
  };
  const labels = {
    A: board.label(state.A, "A", "glabel", -18, 24, labelLayer),
    B: board.label(state.B, "B", "glabel", -18, -10, labelLayer),
    C: board.label(state.C, "C", "glabel", 10, 4, labelLayer),
    I: board.label(state.A, "I", "glabel i-label", 9, -8, labelLayer),
    O: board.label(state.A, "O", "glabel o-label", 9, -8, labelLayer),
    OA: board.label(state.A, "O_A", "glabel center-label", 8, -8, labelLayer),
    OB: board.label(state.A, "O_B", "glabel center-label", -34, 18, labelLayer),
    OC: board.label(state.A, "O_C", "glabel center-label", 8, 20, labelLayer),
  };

  /**
   * The status line is spoken and read by the player's record. There is no
   * win or loss in this illustration; "done" marks a theorem check.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    const ok = !m.degenerate;
    const showBig = toggles.big.checked;
    const showIncircle = toggles.incircle.checked;
    const showSmall = toggles.small.checked;

    triangle.set([state.A, state.B, state.C]);
    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    bisectors[0].show(ok && finite(m.I));
    bisectors[1].show(ok && finite(m.I));
    bisectors[2].show(ok && finite(m.I));
    if (ok) {
      bisectors[0].set(state.A, m.I);
      bisectors[1].set(state.B, m.I);
      bisectors[2].set(state.C, m.I);
    }

    incircle.show(ok && showIncircle && Boolean(m.incircle));
    if (ok && m.incircle) incircle.set(m.incircle.center, m.incircle.radius);
    bigCircle.show(ok && showBig && Boolean(m.bigCircle));
    if (ok && m.bigCircle) bigCircle.set(m.bigCircle.center, m.bigCircle.radius);
    for (const key of ["A", "B", "C"]) {
      const c = m.small[key];
      smallCircles[key].show(ok && showSmall && Boolean(c));
      if (c) smallCircles[key].set(c.center, c.radius);
      centerDots[key].show(ok && showSmall && Boolean(c) && finite(c.center));
      if (c && finite(c.center)) centerDots[key].set(c.center);
    }

    iDot.show(ok && finite(m.I));
    if (ok) iDot.set(m.I);
    oDot.show(ok && showBig && Boolean(m.bigCircle) && finite(m.bigCircle.center));
    if (ok && m.bigCircle) oDot.set(m.bigCircle.center);

    for (const key of ["A", "B", "C"]) labels[key].set(state[key]);
    labels.A.show(true); // keep vertex names visible even near a degenerate drag
    labels.B.show(true);
    labels.C.show(true);
    labels.I.show(ok && finite(m.I));
    if (ok) labels.I.set(m.I);
    labels.O.show(ok && showBig && Boolean(m.bigCircle) && finite(m.bigCircle.center));
    if (ok && m.bigCircle) labels.O.set(m.bigCircle.center);
    for (const [key, tag] of [["A", "OA"], ["B", "OB"], ["C", "OC"]]) {
      const c = m.small[key];
      labels[tag].show(ok && showSmall && Boolean(c) && finite(c.center));
      if (c && finite(c.center)) labels[tag].set(c.center);
    }

    if (!ok) {
      say("Move the corners apart to make a triangle.");
    } else if (checked) {
      say("Checked: all three centers lie on the big circle, on their bisectors, and form the same circle.", "done");
    } else if (showSmall) {
      say("Drag A, B or C: the three centers keep to the big circle; press Check the theorem to test this triangle.");
    } else {
      say("Drag A, B or C, then tick a box to show the incircle or the circumcircles.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const handleOpts = (name) => ({
    r: 10, step: 4, shift: 16, layer: handleLayer, clamp: inside,
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex(name, p),
  });
  const handles = {
    A: board.handle("A", state.A, handleOpts("A")),
    B: board.handle("B", state.B, handleOpts("B")),
    C: board.handle("C", state.C, handleOpts("C")),
  };

  function reset() {
    state = Core.start();
    checked = false;
    for (const key of ["A", "B", "C"]) handles[key].set(state[key]);
    render();
    handles.A.node.focus();
  }

  function checkTheorem() {
    checked = Core.claims(state).all;
    render();
    if (!checked) say("Move the corners apart, then check again.");
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkTheorem);
  for (const input of Object.values(toggles)) input.addEventListener("change", render);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") checkTheorem();
  });

  board.onTheme(render);
  render();
})();
