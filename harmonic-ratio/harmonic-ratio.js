"use strict";

/*
 * The page for Harmonic Ratio: drawing and input only; the construction and
 * its claims live in harmonic-ratio-core.js. An SVG shows the line AB with C
 * on it, a second line AE with I on it, the four lines of the complete
 * quadrilateral and its three diagonals. Five labelled handles can be dragged
 * with a pointer or moved with the arrow keys; the dot D is the fixed point
 * the construction keeps finding.
 */

(function () {
  const Core = HarmonicRatioCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");

  let state = Core.start();
  let checked = false;

  const guides = board.layer("guides");
  const diagonalLayer = board.layer("diagonals");
  const marks = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const P = state.points;
  const first = P.A;

  /* The lines are made once and only re-set, so focus on a handle survives a
     redraw. Full lines are clipped to the viewBox, as DoubLine.SetBounds did. */
  const baseLine = board.line(first, P.B, "base-line", guides);
  const sideLine = board.line(first, P.E, "side-line", guides);
  const ecLine = board.line(P.E, P.C, "ec-line", guides);
  const ibLine = board.line(P.I, P.B, "ib-line", guides);
  const agLine = board.line(first, first, "ag-line", diagonalLayer);
  const ebLine = board.line(P.E, P.B, "eb-line", diagonalLayer);
  const ifLine = board.line(first, first, "if-line", diagonalLayer);

  const dDot = board.point(first, "target-dot", 7, marks);
  const fDot = board.point(first, "aux-dot", 5, marks);
  const gDot = board.point(first, "aux-dot", 5, marks);
  const hDot = board.point(first, "aux-dot", 4, marks);

  const names = [...Core.NAMES, "D", "F", "G", "H"];
  const labels = {};
  names.forEach((n) => { labels[n] = board.label(first, n, "glabel", -8, -12, labelLayer); });

  /** Show a line only when both ends are usable points. */
  function setLine(shape, a, b, show) {
    const ok = show !== false && Core.isFinitePoint(a) && Core.isFinitePoint(b);
    shape.show(ok);
    if (ok) shape.set(a, b);
    return shape;
  }

  /** Show a point only when the construction produced a usable point. */
  function setDot(shape, p, show) {
    const ok = show !== false && Core.isFinitePoint(p);
    shape.show(ok);
    if (ok) shape.set(p);
    return shape;
  }

  /** The status line; "done" is how the record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.compute(state);
    const pts = state.points;

    setLine(baseLine, pts.A, pts.B);
    setLine(sideLine, pts.A, pts.E);
    setLine(ecLine, pts.E, pts.C);
    setLine(ibLine, pts.I, pts.B);
    setLine(agLine, pts.A, m.G, m.finite);
    setLine(ebLine, pts.E, pts.B);
    setLine(ifLine, pts.I, m.F, m.finite);

    setDot(dDot, m.D, m.finite);
    setDot(fDot, m.F, m.finite);
    setDot(gDot, m.G, m.finite);
    setDot(hDot, m.H, m.finite);

    Core.NAMES.forEach((n) => {
      labels[n].set(pts[n]);
      handles[n].set(pts[n]);
    });
    [["D", m.D], ["F", m.F], ["G", m.G], ["H", m.H]].forEach(([n, p]) => {
      labels[n].show(state.showNames && Core.isFinitePoint(p));
      if (Core.isFinitePoint(p)) labels[n].set(p);
    });
    Core.NAMES.forEach((n) => labels[n].show(state.showNames));

    if (checked && m.finite) {
      const ratio = Core.crossRatio(pts.A, pts.B, pts.C, m.D);
      say(`D is at (${Math.round(m.D.x)}, ${Math.round(m.D.y)}): (ABCD) = ${ratio.toFixed(2)}. Move E or I — D stays put.`, "done");
    } else if (checked) {
      say("Two of the lines are almost parallel. Move a point and check again.", null);
    } else {
      say("Drag A, B, C, E or I to reshape the picture, then press Check the ratio.", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampBoard = (q) => ({
    x: Geom.clamp(q.x, 16, state.width - 16),
    y: Geom.clamp(q.y, 16, state.height - 16),
  });
  const clampC = (q) => Core.projectToSegment(q, state.points.A, state.points.B);
  const clampI = (q) => Core.projectToSegment(q, state.points.A, state.points.E);

  const handles = {};
  Core.NAMES.forEach((n) => {
    handles[n] = board.handle(n, state.points[n], {
      r: 9,
      step: 4,
      shift: 16,
      layer: handlesLayer,
      clamp: n === "C" ? clampC : n === "I" ? clampI : clampBoard,
      label: `Point ${n}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, name) => {
        state = Core.withPoint(state, name, p);
        checked = false;
        render();
      },
    });
  });

  function reset() {
    state = Core.start({ showNames: state.showNames });
    checked = false;
    render();
    handles.A.node.focus();
  }
  function check() {
    checked = true;
    render();
  }
  function toggleNames() {
    state = Core.withOptions(state, { showNames: !state.showNames });
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", check);
  namesBtn.addEventListener("click", toggleNames);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c" || k === "v") check();
    else if (k === "n") toggleNames();
  });

  board.onTheme(render);
  render();
})();
