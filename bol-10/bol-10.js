"use strict";

/*
 * The page for BOL10: drawing and input only; the geometry is in
 * bol-10-core.js. An SVG holds the circle, the two tangents from T, the secant
 * TC, the chord BD drawn parallel to it, and the perpendicular from E to BD.
 * O, Bo, T and C are draggable and keyboard-movable, as in the applet.
 */

(function () {
  const Core = Bol10Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const randomBtn = document.getElementById("randomBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const tickEnds = (p, direction, size) => {
    const d = { x: direction.x - direction.y, y: direction.x + direction.y };
    const n = Math.hypot(d.x, d.y) || 1;
    return [
      { x: p.x - (d.x / n) * size, y: p.y - (d.y / n) * size },
      { x: p.x + (d.x / n) * size, y: p.y + (d.y / n) * size },
    ];
  };

  let state = Core.start({ angle: 2.2 });
  let checked = false;
  let showNames = true;
  let showStatement = true;
  let showHint = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every object is made once; a redraw only changes its geometry, so the
   * keyboard focus on a handle survives a drag or a theme change. */
  const circle = board.circle(state.O, state.radius, "main-circle", shapes);
  const secantChord = board.segment(state.C, state.C, "secant-chord", guides);
  const secantLine = board.line(state.T, state.C, "secant", guides);
  const tangentA = board.segment(state.T, state.T, "tangent", shapes);
  const tangentB = board.segment(state.T, state.T, "tangent", shapes);
  const chordBD = board.segment(state.Bo, state.Bo, "chord", shapes);
  const lineAD = board.segment(state.Bo, state.Bo, "construction", guides);
  const lineAB = board.segment(state.Bo, state.Bo, "construction", guides);
  const lineEB = board.segment(state.Bo, state.Bo, "construction", guides);
  const lineEH = board.segment(state.Bo, state.Bo, "bisector", shapes);
  const rightAngle = board.rightAngle(state.Bo, state.T, state.Bo, 9, "right-angle", marks);
  const tick1 = board.segment(state.Bo, state.Bo, "tick", marks);
  const tick2 = board.segment(state.Bo, state.Bo, "tick", marks);
  const dotA = board.point(state.Bo, "plain-dot", 3.5, marks);
  const dotB = board.point(state.Bo, "plain-dot", 3.5, marks);
  const dotD = board.point(state.Bo, "plain-dot", 3.5, marks);
  const dotE = board.point(state.Bo, "plain-dot", 3.5, marks);
  const dotF = board.point(state.Bo, "plain-dot", 4, marks);
  const dotH = board.point(state.Bo, "mid-dot", 4.5, marks);
  const hintEA = board.segment(state.Bo, state.Bo, "hint-line", guides);
  const hintET = board.segment(state.Bo, state.Bo, "hint-line", guides);
  const hintBF = board.segment(state.Bo, state.Bo, "hint-line", guides);
  const labels = [
    ["A", board.label(state.Bo, "A", "glabel", -16, -8, marks)],
    ["B", board.label(state.Bo, "B", "glabel", -16, 16, marks)],
    ["C", board.label(state.Bo, "C", "glabel", 8, -8, marks)],
    ["D", board.label(state.Bo, "D", "glabel", 8, -8, marks)],
    ["E", board.label(state.Bo, "E", "glabel", 8, 16, marks)],
    ["F", board.label(state.Bo, "F", "glabel", -6, -12, marks)],
    ["H", board.label(state.Bo, "H", "glabel mid-label", -16, -8, marks)],
    ["T", board.label(state.Bo, "T", "glabel", 8, -8, marks)],
  ];

  /** The status line. "done" is the only kind here: an illustration has no
   *  winner, and the shared record reads the class when a claim is checked. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function showShape(shape, on) {
    shape.show(Boolean(on));
  }

  function render() {
    const m = Core.measurements(state);
    const valid = m.valid;
    circle.set(m.O, m.radius);
    secantLine.set(m.T, m.C);
    showShape(secantChord, valid);
    showShape(tangentA, valid);
    showShape(tangentB, valid);
    showShape(chordBD, valid);
    showShape(lineAD, valid);
    showShape(lineAB, valid);
    showShape(lineEB, valid);
    showShape(lineEH, valid);
    showShape(rightAngle, valid);
    showShape(dotA, valid);
    showShape(dotB, valid);
    showShape(dotD, valid);
    showShape(dotE, valid);
    showShape(dotF, valid);
    showShape(dotH, valid);

    if (valid) {
      secantChord.set(m.C2, m.C);
      tangentA.set(m.T, m.A);
      tangentB.set(m.T, m.B);
      chordBD.set(m.B, m.D);
      lineAD.set(m.A, m.D);
      lineAB.set(m.A, m.B);
      lineEB.set(m.E, m.B);
      lineEH.set(m.E, m.H);
      rightAngle.set(m.H, m.E, m.B, 9);
      dotA.set(m.A); dotB.set(m.B); dotD.set(m.D);
      dotE.set(m.E); dotF.set(m.F); dotH.set(m.H);
      const direction = { x: m.D.x - m.B.x, y: m.D.y - m.B.y };
      const len = Math.hypot(direction.x, direction.y) || 1;
      const unit = { x: direction.x / len, y: direction.y / len };
      const t1 = tickEnds(mid(m.B, m.H), unit, 4);
      const t2 = tickEnds(mid(m.H, m.D), unit, 4);
      tick1.set(t1[0], t1[1]);
      tick2.set(t2[0], t2[1]);
      hintEA.set(m.E, m.A);
      hintET.set(m.E, m.T);
      hintBF.set(m.B, m.F);
    }
    showShape(tick1, valid && showStatement);
    showShape(tick2, valid && showStatement);
    showShape(hintEA, valid && showHint);
    showShape(hintET, valid && showHint);
    showShape(hintBF, valid && showHint);

    const positions = {
      A: m.A, B: m.B, C: m.C, D: m.D, E: m.E,
      F: m.F, H: m.H, T: m.T,
    };
    for (const [name, label] of labels) {
      showShape(label, valid && showNames);
      if (valid) label.set(positions[name]);
    }

    if (!valid) {
      if (m.reason === "radius") say("Move the radius point away from the centre to draw a circle.", null);
      else say("Move T outside the circle to see the two tangents.", null);
    } else if (m.thin) {
      say("The secant almost touches the circle. Drag C away from that point.", null);
    } else if (checked) {
      say(`BH = ${fmt(m.lengths.BH)} and HD = ${fmt(m.lengths.HD)}. H is the midpoint of BD.`, "done");
    } else {
      say(`Drag O, Bo, T or C, or use the arrow keys. BH = ${fmt(m.lengths.BH)}, HD = ${fmt(m.lengths.HD)}.`, null);
    }
    /* The position, for the player's record and the tutor. */
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const clampInside = (p) => inside(p);
  const handleOpts = (name, label, step) => ({
    r: 9, step: step, shift: step * 4, layer: handlesLayer,
    clamp: clampInside,
    label: label,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move(name, p),
  });
  board.handle("O", state.O, handleOpts("O",
    "Centre O of the circle. Drag, or focus and use the arrow keys.", 3));
  board.handle("Bo", state.Bo, handleOpts("Bo",
    "Radius point Bo on the circle. Drag to resize, or use the arrow keys.", 3));
  board.handle("T", state.T, handleOpts("T",
    "Point T outside the circle. Drag, or focus and use the arrow keys.", 3));
  board.handle("C", state.C, handleOpts("C",
    "Point C on the circle. Drag along it, or use the arrow keys.", 3));

  function newDiagram() {
    state = Core.start({ angle: 2.2 });
    checked = false;
    render();
    document.querySelector('#board [aria-label^="Centre O"]').focus();
  }

  function randomise() {
    const angle = (Math.random() * Math.PI) / 2; // BOL10Canvas.init's range
    state = Core.start({ angle });
    checked = false;
    render();
  }

  function checkClaim() {
    const m = Core.measurements(state);
    const cl = Core.claims(state);
    checked = Boolean(m.valid && !m.thin && cl.midpoint);
    render();
    if (!m.valid || m.thin) say("Move the handles to make a clear secant, then check again.", null);
    else if (!cl.midpoint) say("Move the handles apart, then check again.", null);
  }

  function toggle(btn, current, labelOn, labelOff, setter) {
    const next = !current;
    setter(next);
    btn.setAttribute("aria-pressed", String(next));
    btn.textContent = next ? labelOn : labelOff;
    render();
  }

  newBtn.addEventListener("click", newDiagram);
  randomBtn.addEventListener("click", randomise);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, showNames, "Hide names", "Show names", (v) => { showNames = v; }));
  statementBtn.addEventListener("click", () =>
    toggle(statementBtn, showStatement, "Hide equal marks", "Show equal marks",
      (v) => { showStatement = v; }));
  hintBtn.addEventListener("click", () =>
    toggle(hintBtn, showHint, "Hide hint", "Show hint", (v) => { showHint = v; }));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") newDiagram();
    if (e.key === "c" || e.key === "C") checkClaim();
  });

  board.onTheme(render);
  render();
})();
