"use strict";

/*
 * The page for Angle Bisector Ratio 2: drawing and input only; the geometry is
 * in angle-bisector-ratio-2-core.js. An SVG holds a triangle with three
 * draggable corners, the bisector from A to its foot D, and — when asked for —
 * the hint lines and McWorter's extra point E on line AD. The status line shows
 * the two ratios the page says are equal.
 */

(function () {
  const Core = AngleBisectorRatio2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const extraBtn = document.getElementById("extraBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 16, view.x + view.width - 16),
    y: Geom.clamp(p.y, view.y + 16, view.y + view.height - 16),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start();
  let showNames = true;
  let showHint = false;
  let showExtra = false;
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every object is made once; render() only changes its geometry. */
  const triangle = board.polygon([state.A, state.B, state.C], "tri-side", shapes);
  const bisector = board.segment(state.A, state.B, "bisector", shapes);
  const extraBE = board.segment(state.B, state.A, "extra-line", shapes);
  const extraAE = board.segment(state.A, state.B, "extra-line faint", shapes);
  const dDot = board.point(state.B, "foot-dot", 5, marks);
  const eDot = board.point(state.B, "extra-dot", 5, marks);
  const tickBD = board.segment(state.B, state.C, "tick", marks);
  const tickBE = board.segment(state.B, state.C, "tick", marks);

  const halfArcs = [
    board.angleArc(state.A, state.B, state.C, 34, "half-arc", marks),
    board.angleArc(state.A, state.C, state.B, 34, "half-arc alt", marks),
  ];
  const extraArcs = [
    board.angleArc(state.B, state.A, state.C, 30, "proof-arc", marks),
    board.angleArc(state.B, state.A, state.C, 42, "proof-arc alt", marks),
    board.angleArc(state.C, state.A, state.B, 30, "proof-arc", marks),
  ];

  const labels = [
    board.label(state.A, "A", "glabel", -26, 30, marks),
    board.label(state.B, "B", "glabel", 10, 30, marks),
    board.label(state.C, "C", "glabel", -8, -18, marks),
    board.label(state.B, "D", "glabel foot-label", -8, 28, marks),
    board.label(state.B, "E", "glabel extra-label", 10, -12, marks),
  ];

  /* The applet's Hint draws families of parallel segments across the two
   * triangles; up to 14 of each, so the drawing stays readable. */
  const hintAB = [], hintAC = [];
  for (let i = 0; i < 14; i++) {
    hintAB.push(board.segment(state.A, state.B, "hint-line", guides));
    hintAC.push(board.segment(state.A, state.C, "hint-line", guides));
  }

  /**
   * Shows a line under the game. `kind` is "done" once the claim has been
   * checked (there is no win or loss); the shared record reads the class.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** A small cross-stroke showing that two segments are the same length. */
  function tickAt(p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const nx = (-dy / len) * 7, ny = (dx / len) * 7;
    return [{ x: mx - nx, y: my - ny }, { x: mx + nx, y: my + ny }];
  }

  function render() {
    const m = Core.measurements(state);
    const A = state.A, B = state.B, Cc = state.C;
    const D = m.D, E = m.E;
    const good = !m.degenerate && Boolean(D) && Boolean(E);

    triangle.set([A, B, Cc]);
    bisector.show(good);
    dDot.show(good);
    halfArcs[0].show(good);
    halfArcs[1].show(good);
    labels[3].show(good && showNames);
    if (good) {
      bisector.set(A, D);
      dDot.set(D);
      halfArcs[0].set(A, B, D, 34);
      halfArcs[1].set(A, D, Cc, 34);
      labels[3].set(D);
    }

    /* Hint: divide AB (or BE with the extra construction) and AC by the
     * number of strokes, and join matching fractions. All these strokes are
     * parallel to AD, which is what makes the side ratio visible. */
    const nAB = good ? Math.max(2, Math.min(14, Math.round(Core.distance(A, B) / 45))) : 0;
    const nAC = good ? Math.max(2, Math.min(14, Math.round(Core.distance(A, Cc) / 45))) : 0;
    const endAB = showExtra && good ? E : D;
    for (let i = 0; i < 14; i++) {
      const on = showHint && good && i + 1 < nAB;
      hintAB[i].show(on);
      if (on) hintAB[i].set(Core.lerp(A, B, (i + 1) / nAB), Core.lerp(endAB, B, (i + 1) / nAB));
      const onC = showHint && good && i + 1 < nAC;
      hintAC[i].show(onC);
      if (onC) hintAC[i].set(Core.lerp(A, Cc, (i + 1) / nAC), Core.lerp(D, Cc, (i + 1) / nAC));
    }

    extraBE.show(good && showExtra);
    extraAE.show(good && showExtra);
    eDot.show(good && showExtra);
    tickBD.show(good && showExtra);
    tickBE.show(good && showExtra);
    labels[4].show(good && showExtra && showNames);
    extraArcs[0].show(good && !showExtra);
    extraArcs[1].show(good && showExtra);
    extraArcs[2].show(good && showExtra);
    if (good) {
      extraBE.set(B, E);
      extraAE.set(A, E);
      eDot.set(E);
      const db = tickAt(B, D), be = tickAt(B, E);
      tickBD.set(db[0], db[1]);
      tickBE.set(be[0], be[1]);
      labels[4].set(E);
      extraArcs[0].set(B, A, Cc, 30);
      extraArcs[1].set(B, A, E, 42);
      extraArcs[2].set(Cc, A, B, 30);
    }

    labels[0].show(showNames);
    labels[1].show(showNames);
    labels[2].show(showNames);
    labels[0].set(A);
    labels[1].set(B);
    labels[2].set(Cc);

    if (!good) {
      say("Move the corners apart to make a triangle.", null);
    } else {
      const r = m.ratios;
      let line = `AB / AC = ${fmt(r.AB_AC)} and DB / DC = ${fmt(r.DB_DC)}.`;
      if (showExtra) line += ` BE / DC = ${fmt(r.BE_DC)} and BD / BE = ${fmt(1 / r.BE_BD)}.`;
      line += checked
        ? " The two numbers match: the angle bisector divides the far side in the ratio of the two sides."
        : " Drag a corner, or press Check the ratio.";
      say(line, checked ? "done" : null);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const handles = ["A", "B", "C"].map((name) => board.handle(name, state[name], {
    r: 11, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveVertex(name, p),
  }));

  function toggle(btn, on, onText, offText, label) {
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? onText : offText;
    btn.setAttribute("aria-label", label + (on ? " (on)" : " (off)"));
  }

  namesBtn.addEventListener("click", () => {
    showNames = !showNames;
    toggle(namesBtn, showNames, "Hide names", "Show names", "Toggle the point names");
    render();
  });
  hintBtn.addEventListener("click", () => {
    showHint = !showHint;
    toggle(hintBtn, showHint, "Hide hint", "Show hint", "Toggle the parallel hint lines");
    render();
  });
  extraBtn.addEventListener("click", () => {
    showExtra = !showExtra;
    toggle(extraBtn, showExtra, "Hide extra construction", "Show extra construction",
      "Toggle the extra point E and the equal segments");
    render();
  });
  checkBtn.addEventListener("click", () => {
    checked = true;
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.start();
    checked = false;
    showHint = false;
    showExtra = false;
    toggle(namesBtn, showNames, "Hide names", "Show names", "Toggle the point names");
    toggle(hintBtn, showHint, "Hide hint", "Show hint", "Toggle the parallel hint lines");
    toggle(extraBtn, showExtra, "Hide extra construction", "Show extra construction",
      "Toggle the extra point E and the equal segments");
    render();
    handles[0].node.focus();
  });

  /* A theme flip changes only CSS colours, but redraw all the geometry so the
   * SVG keeps the same classes and the same focus. */
  board.onTheme(render);
  render();
})();
