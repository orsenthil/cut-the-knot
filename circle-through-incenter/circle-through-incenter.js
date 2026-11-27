"use strict";

/*
 * The page for CircleThroughIncenter: drawing and input only; the geometry is
 * in circle-through-incenter-core.js. An SVG holds a triangle with three
 * draggable corners, the circle through A, B and its incenter I, and the two
 * crossings X on AC and Y on BC. The four checkboxes copy the applet's Show
 * statement / premises / hint / names options; Reset restores its start.
 */

(function () {
  const Core = CircleThroughIncenterCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");
  const toggles = {
    statement: document.getElementById("showStatement"),
    premises: document.getElementById("showPremises"),
    hint: document.getElementById("showHint"),
    names: document.getElementById("showNames"),
  };

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();

  const guides = board.layer("guides");
  const circles = board.layer("circles");
  const chords = board.layer("chords");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const sideAB = board.segment(state.A, state.B, "tri-side", guides);
  const lineAC = board.line(state.C, state.A, "side-line", guides);
  const lineBC = board.line(state.C, state.B, "side-line", guides);
  const bisector = board.line(state.C, state.A, "bisector", guides);
  const abiCircle = board.circle(state.A, 1, "abi-circle", circles);
  const centerDot = board.point(state.A, "center-dot", 5, marks);
  const centerLabel = board.label(state.A, "O", "glabel center-label", 8, -8, labels);
  const Idot = board.point(state.A, "incenter-dot", 5, marks);
  const Jdot = board.point(state.A, "hint-dot", 4.5, marks);
  const Xdot = board.point(state.A, "cross-dot", 4.5, marks);
  const Ydot = board.point(state.B, "cross-dot", 4.5, marks);
  const equalA = board.segment(state.A, state.A, "equal-chord", chords);
  const equalB = board.segment(state.B, state.B, "equal-chord", chords);
  const tickA1 = board.segment(state.A, state.A, "tick", chords);
  const tickA2 = board.segment(state.A, state.A, "tick", chords);
  const tickB1 = board.segment(state.B, state.B, "tick", chords);
  const tickB2 = board.segment(state.B, state.B, "tick", chords);

  const premiseArcs = [
    board.angleArc(state.C, state.A, state.B, 26, "premise-arc", marks),
    board.angleArc(state.C, state.A, state.I || state.B, 19, "premise-arc alt", marks),
    board.angleArc(state.C, state.I || state.A, state.B, 19, "premise-arc", marks),
    board.angleArc(state.A, state.B, state.I || state.C, 17, "premise-arc", marks),
    board.angleArc(state.B, state.A, state.I || state.C, 17, "premise-arc alt", marks),
    board.angleArc(state.A, state.I || state.B, state.C, 13, "premise-arc alt", marks),
  ];

  const pointLabels = {
    A: board.label(state.A, "A", "glabel", -20, 26, labels),
    B: board.label(state.B, "B", "glabel", -18, -12, labels),
    C: board.label(state.C, "C", "glabel", 10, 4, labels),
    X: board.label(state.A, "X", "glabel cross-label", 8, -8, labels),
    Y: board.label(state.B, "Y", "glabel cross-label", 8, -8, labels),
    I: board.label(state.A, "I", "glabel center-label", 8, 20, labels),
    J: board.label(state.A, "J", "glabel hint-label", 8, -8, labels),
  };

  /** The status line is spoken and read by the player's record. No win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Put a single short cross-tick at the middle of a segment, if it is long enough. */
  function setTick(shape, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    if (len < 12) {
      shape.show(false);
      return;
    }
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const nx = (-dy / len) * 6, ny = (dx / len) * 6;
    shape.set({ x: mx - nx, y: my - ny }, { x: mx + nx, y: my + ny }).show(true);
  }

  function render() {
    const m = Core.measure(state);
    const showStatement = toggles.statement.checked;
    const showPremises = toggles.premises.checked;
    const showHint = toggles.hint.checked;
    const showNames = toggles.names.checked;

    sideAB.set(state.A, state.B);
    lineAC.set(state.C, state.A);
    lineBC.set(state.C, state.B);
    bisector.set(state.C, m.I || state.C);
    bisector.node.setAttribute("class", showHint ? "bisector hinted" : "bisector");

    const visible = !m.degenerate && Boolean(m.circle && m.I);
    abiCircle.show(visible);
    Idot.show(visible);
    Xdot.show(visible && Boolean(m.X));
    Ydot.show(visible && Boolean(m.Y));
    centerDot.show(visible && showHint);
    centerLabel.show(visible && showHint && showNames);
    Jdot.show(visible && showHint && Boolean(m.J));
    pointLabels.I.show(visible && showNames);
    pointLabels.X.show(visible && showNames && Boolean(m.X));
    pointLabels.Y.show(visible && showNames && Boolean(m.Y));
    pointLabels.J.show(visible && showHint && showNames && Boolean(m.J));
    for (const key of ["A", "B", "C"]) pointLabels[key].show(showNames);

    if (visible) {
      abiCircle.set(m.circle.center, m.circle.radius);
      Idot.set(m.I);
      centerDot.set(m.Oc);
      centerLabel.set(m.Oc);
      if (m.X) { Xdot.set(m.X); pointLabels.X.set(m.X); }
      if (m.Y) { Ydot.set(m.Y); pointLabels.Y.set(m.Y); }
      if (m.J) { Jdot.set(m.J); pointLabels.J.set(m.J); }
    }
    pointLabels.A.set(state.A);
    pointLabels.B.set(state.B);
    pointLabels.C.set(state.C);
    pointLabels.I.set(m.I || state.A);

    equalA.show(visible && showStatement && Boolean(m.X));
    equalB.show(visible && showStatement && Boolean(m.Y));
    if (m.X) equalA.set(state.A, m.X);
    if (m.Y) equalB.set(state.B, m.Y);
    setTick(tickA1, state.A, m.X || state.A);
    setTick(tickA2, state.A, m.X || state.A);
    setTick(tickB1, state.B, m.Y || state.B);
    setTick(tickB2, state.B, m.Y || state.B);
    for (const t of [tickA1, tickA2, tickB1, tickB2]) {
      if (!showStatement || !visible) t.show(false);
    }

    const arcs = [
      [state.C, state.A, state.B],
      [state.C, state.A, m.I || state.B],
      [state.C, m.I || state.A, state.B],
      [state.A, state.B, m.I || state.C],
      [state.B, state.A, m.I || state.C],
      [state.A, m.I || state.B, state.C],
    ];
    premiseArcs.forEach((arc, i) => {
      arc.show(visible && showPremises);
      if (visible && showPremises) arc.set(arcs[i][0], arcs[i][1], arcs[i][2], 26 - 3 * Math.floor(i / 2));
    });

    if (m.degenerate) {
      say("Move the corners apart to make a triangle.");
    } else {
      say(`AX = ${fmt(m.AX)} and BY = ${fmt(m.BY)} — the circle cuts equal lengths off the two sides.`);
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const clampVertex = (p) => inside(p);
  const vertexLabel = (name) =>
    `Corner ${name}. Drag it, or focus it and use the arrow keys to move it`;
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const handles = {
    A: board.handle("A", state.A, {
      r: 13, step: 5, shift: 20, layer: handlesLayer, clamp: clampVertex,
      label: vertexLabel("A"), describe, onMove: (p) => move("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 13, step: 5, shift: 20, layer: handlesLayer, clamp: clampVertex,
      label: vertexLabel("B"), describe, onMove: (p) => move("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 13, step: 5, shift: 20, layer: handlesLayer, clamp: clampVertex,
      label: vertexLabel("C"), describe, onMove: (p) => move("C", p),
    }),
  };

  function reset() {
    state = Core.start();
    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    render();
    handles.A.node.focus();
  }

  resetBtn.addEventListener("click", reset);
  for (const input of Object.values(toggles)) input.addEventListener("change", render);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") reset();
  });

  board.onTheme(render);
  render();
})();
