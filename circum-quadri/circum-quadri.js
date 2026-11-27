"use strict";

/*
 * The page for Circum Quadri: drawing and input only; the geometry is in
 * circum-quadri-core.js. An SVG holds a circle with four draggable touch
 * points. The tangents there make a quadrilateral around the circle; the page
 * draws its sides, its two diagonals, the chords between opposite touch
 * points, and, after Check the theorem, the point where all four lines meet.
 * Every element is created once and only its geometry changes on a redraw, so
 * a handle keeps keyboard focus while the player moves it.
 */

(function () {
  const Core = CircumQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const names = Core.NAMES;
  const P = state.points;
  const V = Core.vertices(state);
  const first = V[0] || P.A;

  /** Show a segment only when both of its ends are usable points. */
  function setSegment(shape, a, b) {
    const ok = Core.isFinitePoint(a) && Core.isFinitePoint(b);
    shape.show(ok);
    if (ok) shape.set(a, b);
    return shape;
  }

  const circle = board.circle(state.circle.center, state.circle.radius, "circumcircle", guides);
  const halfSides = Core.halfSides(state).map(([a, b]) => board.segment(a, b, "half-side", guides));
  const quad = board.polygon(V, "quad", shapes);
  const diagonals = [0, 1].map(() => board.segment(first, first, "diagonal", shapes));
  const chords = [0, 1].map(() => board.segment(first, first, "chord", shapes));
  const meeting = board.point(first, "meeting-dot", 5, marks);
  const labels = names.map((n) => board.label(P[n], n, "glabel", -14, -10, marks));

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    circle.set(m.circle.center, m.circle.radius);

    m.halfSides.forEach(([a, b], i) => setSegment(halfSides[i], a, b));
    quad.show(m.finite);
    if (m.finite) quad.set(m.vertices);
    for (let i = 0; i < 2; i++) {
      setSegment(diagonals[i], m.diagonals[i][0], m.diagonals[i][1]);
      setSegment(chords[i], m.chords[i][0], m.chords[i][1]);
    }
    names.forEach((n, i) => {
      labels[i].set(m.points[n]);
      handles[n].set(m.points[n]);
    });

    const holds = Boolean(m.concurrent) && m.concurrent.error < m.tolerance;
    meeting.show(state.checked && holds);
    if (state.checked && holds) meeting.set(m.concurrent.point);

    say(Core.describe(state), state.checked && holds ? "done" : null);
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampToCircle = (q) => Core.projectToCircle(q, state.circle);
  const handles = {};
  names.forEach((n) => {
    handles[n] = board.handle(n, state.points[n], {
      r: 8, step: 3, shift: 12, layer: handlesLayer, clamp: clampToCircle,
      label: `Touch point ${n}. Drag around the circle, or focus and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  });

  function reset() {
    state = Core.reset(state);
    render();
    handles.A.node.focus();
  }
  function checkTheorem() {
    state = Core.check(state);
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkTheorem);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c" || k === "v") checkTheorem();
  });

  board.onTheme(render);
  render();
})();
