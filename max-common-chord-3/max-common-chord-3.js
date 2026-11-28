"use strict";

/*
 * The page for Max Common Chord 3: drawing and input only. All the geometry
 * lives in max-common-chord-3-core.js. The SVG has the two given circles and
 * their radical axis PQ, the chord AB, the circle through A, B, Q (centred at
 * S), and the auxiliary circle through the two given centres and Q. Four
 * handles move P, Q, A and B exactly as the applet's BetterMover did; the two
 * radio buttons choose whether dragging A or B also changes its circle.
 */

(function () {
  const Core = MaxCommonChord3Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const bestBtn = document.getElementById("bestBtn");
  const circlesBtn = document.getElementById("circlesBtn");
  const chordBtn = document.getElementById("chordBtn");
  const namesBtn = document.getElementById("namesBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start({ width: view.width, height: view.height });

  const circlesLayer = board.layer("circles");
  const linesLayer = board.layer("lines");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Every object is created once; render only moves it or shows and hides it. */
  const circleE = board.circle(state.P, 1, "given-circle circle-e", circlesLayer);
  const circleF = board.circle(state.P, 1, "given-circle circle-f", circlesLayer);
  const auxCircle = board.circle(state.P, 1, "aux-circle", circlesLayer);
  const abCircle = board.circle(state.P, 1, "ab-circle", circlesLayer);
  const axis = board.line(state.P, state.Q, "axis-line", linesLayer);
  const chord = board.segment(state.A, state.B, "chord", linesLayer);
  const snLine = board.line(state.S || state.P, state.P, "perp-line", linesLayer);
  const sqLine = board.segment(state.Q, state.S || state.P, "radius-line", linesLayer);
  const srLine = board.segment(state.Q, state.S || state.P, "radius-line alt", linesLayer);
  const angleArcs = [
    board.angleArc(state.Q, state.U || state.P, state.S || state.Q, 26, "equal-arc", marksLayer),
    board.angleArc(state.Q, state.S || state.P, state.T || state.Q, 26, "equal-arc alt", marksLayer),
  ];
  const rightMark = board.rightAngle(state.P, state.Q, state.S || state.P, 9, "right-mark", marksLayer);
  const dots = {
    E: board.point(state.P, "centre-dot", 4, marksLayer),
    F: board.point(state.P, "centre-dot", 4, marksLayer),
    O: board.point(state.P, "centre-dot", 4, marksLayer),
    S: board.point(state.P, "key-dot", 5, marksLayer),
    R: board.point(state.P, "guide-dot", 3.5, marksLayer),
    U: board.point(state.P, "guide-dot", 3.5, marksLayer),
    N: board.point(state.P, "guide-dot", 3.5, marksLayer),
    T: board.point(state.P, "guide-dot", 3.5, marksLayer),
  };
  const labels = {
    P: board.label(state.P, "P", "glabel", -17, -10, labelsLayer),
    Q: board.label(state.Q, "Q", "glabel", -17, 22, labelsLayer),
    A: board.label(state.A, "A", "glabel", -17, 22, labelsLayer),
    B: board.label(state.B, "B", "glabel", 6, -10, labelsLayer),
    E: board.label(state.P, "E", "glabel small", -16, -10, labelsLayer),
    F: board.label(state.P, "F", "glabel small", -16, -10, labelsLayer),
    O: board.label(state.P, "O", "glabel small", -16, -10, labelsLayer),
    S: board.label(state.P, "S", "glabel key", 7, -10, labelsLayer),
    R: board.label(state.P, "R", "glabel small", 7, -8, labelsLayer),
    U: board.label(state.P, "U", "glabel small", 7, -8, labelsLayer),
    N: board.label(state.P, "N", "glabel small", 7, -8, labelsLayer),
    T: board.label(state.P, "T", "glabel small", 7, -8, labelsLayer),
  };

  /**
   * The line below the picture. "done" is the class the player's record
   * reads when an illustration has been explored; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showAt(shape, point) {
    shape.show(Boolean(point));
    if (point) shape.set(point);
  }

  function showCircle(shape, circle) {
    shape.show(Boolean(circle));
    if (circle) shape.set(circle.c, circle.r);
  }

  function render() {
    const aux = Core.auxiliary(state);
    const m = Core.measure(state);

    showCircle(circleE, aux.E);
    showCircle(circleF, aux.F);
    showCircle(auxCircle, aux.O);
    showCircle(abCircle, m.valid && m.AB);

    axis.show(aux.valid);
    axis.set(state.P, state.Q);
    chord.show(m.valid);
    chord.set(state.A, state.B);
    chord.node.setAttribute("class", m.finished ? "chord finished" : "chord");

    const built = m.valid && m.S && m.N && m.R && m.U && m.T;
    snLine.show(Boolean(built));
    sqLine.show(Boolean(built));
    srLine.show(Boolean(built));
    rightMark.show(Boolean(built));
    angleArcs.forEach((arc) => arc.show(Boolean(built) && m.finished));
    if (built) {
      snLine.set(m.S, m.N);
      sqLine.set(m.S, state.Q);
      srLine.set(m.S, m.R);
      rightMark.set(m.N, state.Q, m.S, 9);
      angleArcs[0].set(state.Q, m.U, m.S, 26);
      angleArcs[1].set(state.Q, m.S, m.T, 26);
    }

    showAt(dots.E, aux.E && aux.E.c);
    showAt(dots.F, aux.F && aux.F.c);
    showAt(dots.O, aux.O && aux.O.c);
    showAt(dots.S, built && m.S);
    showAt(dots.R, built && m.R);
    showAt(dots.U, built && m.U);
    showAt(dots.N, built && m.N);
    showAt(dots.T, built && m.T);

    const named = {
      P: state.P, Q: state.Q, A: state.A, B: state.B,
      E: aux.E && aux.E.c, F: aux.F && aux.F.c, O: aux.O && aux.O.c,
      S: built && m.S, R: built && m.R, U: built && m.U,
      N: built && m.N, T: built && m.T,
    };
    for (const key in labels) {
      const p = named[key];
      labels[key].show(Boolean(p) && (state.showNames || "PQAB".includes(key)));
      if (p) labels[key].set(p);
    }

    handles.P.set(state.P);
    handles.Q.set(state.Q);
    handles.A.set(state.A);
    handles.B.set(state.B);

    if (!aux.valid) {
      say("Move the four points apart so the two circles can be drawn.", null);
    } else if (!built) {
      say("Move A or B away from P and Q to draw the chord and its construction.", null);
    } else if (m.finished) {
      say(`The arcs match: S bisects arc TU, QR = ${fmt(m.QR)} = 2 × QN, and AP × PB = ${fmt(m.product)} is as large as it gets.`, "done");
    } else {
      say(`QR = ${fmt(m.QR)} and QN = ${fmt(m.QN)}. Make the two arcs at Q equal, or press Show best chord.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const opts = {
    r: 11, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  const handles = {
    P: board.handle("P", state.P, { ...opts,
      label: "Point P, where the two circles meet. Drag, or focus and use the arrow keys to move it.",
      onMove: (p) => moveVertex("P", p) }),
    Q: board.handle("Q", state.Q, { ...opts,
      label: "Point Q, where the two circles meet. Drag, or focus and use the arrow keys to move it.",
      onMove: (p) => moveVertex("Q", p) }),
    A: board.handle("A", state.A, { ...opts,
      label: "Point A on the first circle. Drag, or focus and use the arrow keys to move it.",
      onMove: (p) => moveVertex("A", p) }),
    B: board.handle("B", state.B, { ...opts,
      label: "Point B on the second circle. Drag, or focus and use the arrow keys to move it.",
      onMove: (p) => moveVertex("B", p) }),
  };

  function syncButtons() {
    circlesBtn.setAttribute("aria-pressed", String(state.adjustCircles));
    chordBtn.setAttribute("aria-pressed", String(!state.adjustCircles));
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
  }

  function reset() {
    const fresh = Core.start({ width: view.width, height: view.height });
    state = { ...fresh, adjustCircles: state.adjustCircles, showNames: state.showNames };
    syncButtons();
    render();
    handles.P.node.focus();
  }

  function showBest() {
    const best = Core.auxiliary(state).best;
    if (!best || !best.A || !best.B) {
      say("Move A or B away from P and Q first, then try again.", null);
      return;
    }
    state = { ...state, A: best.A, B: best.B };
    render();
    say(`The best chord is drawn. S is halfway along arc TU: QR = ${fmt(Core.measure(state).QR)} = 2 × QN, and AP × PB = ${fmt(best.product)}.`, "done");
    bestBtn.focus();
  }

  function toggle(name) {
    state = { ...state, [name]: !state[name] };
    syncButtons();
    render();
  }

  newBtn.addEventListener("click", reset);
  bestBtn.addEventListener("click", showBest);
  circlesBtn.addEventListener("click", () => {
    state = { ...state, adjustCircles: true };
    syncButtons();
    render();
  });
  chordBtn.addEventListener("click", () => {
    state = { ...state, adjustCircles: false };
    syncButtons();
    render();
  });
  namesBtn.addEventListener("click", () => toggle("showNames"));

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "b") showBest();
    else if (k === "a") circlesBtn.click();
    else if (k === "c") chordBtn.click();
    else if (k === "n") namesBtn.click();
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
