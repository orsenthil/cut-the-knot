"use strict";

/*
 * The page for Brianchon: drawing and input only; the mathematics is in
 * brianchon-core.js. An SVG holds a fixed circle with six draggable dots on
 * it. The tangents at those dots make a circumscribed hexagon; the page draws
 * its sides, its three major diagonals, and the two optional extras from the
 * applet (extended lines and chords between opposite points of contact).
 */

(function () {
  const Core = BrianchonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const addonsBtn = document.getElementById("addonsBtn");
  const extendBtn = document.getElementById("extendBtn");

  let state = Core.start();
  let checked = false;

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
    shape.show(Core.isFinitePoint(a) && Core.isFinitePoint(b));
    if (Core.isFinitePoint(a) && Core.isFinitePoint(b)) shape.set(a, b);
    return shape;
  }

  /* All elements are made once; a redraw only sets their geometry, so the
     focus stays on whichever dot the player is moving. */
  const circle = board.circle(state.circle.center, state.circle.radius, "circumcircle", guides);
  const sides = [];
  names.forEach((n, i) => {
    sides.push(board.segment(first, P[n], "side", guides));
    sides.push(board.segment(first, P[names[(i + 1) % 6]], "side", guides));
  });
  const extensions = [0, 1, 2].map(() => board.line(first, first, "extension", guides));
  const chords = [0, 1, 2].map(() => board.segment(first, first, "chord", guides));
  const hexagon = board.polygon(V, "hexagon", shapes);
  const diagonals = [0, 1, 2].map(() => board.segment(first, first, "diagonal", shapes));
  const meeting = board.point(first, "meeting-dot", 5, marks);
  const labels = names.map((n) => board.label(P[n], n, "glabel", -14, -10, marks));

  /** The status line; "done" is how the record sees a finished illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    circle.set(m.circle.center, m.circle.radius);

    names.forEach((n, i) => {
      setSegment(sides[2 * i], m.vertices[i], m.points[n]);
      setSegment(sides[2 * i + 1], m.vertices[i], m.points[names[(i + 1) % 6]]);
      labels[i].set(m.points[n]);
      handles[n].set(m.points[n]);
    });
    hexagon.show(m.finite);
    if (m.finite) hexagon.set(m.vertices);
    for (let i = 0; i < 3; i++) {
      setSegment(diagonals[i], m.diagonals[i][0], m.diagonals[i][1]);
      setSegment(extensions[i], m.diagonals[i][0], m.diagonals[i][1]);
      extensions[i].show(state.drawLong && m.finite);
      setSegment(chords[i], m.chords[i][0], m.chords[i][1]);
      chords[i].show(state.addons);
    }

    const holds = m.finite && Boolean(m.concurrent) && m.concurrent.error < m.tolerance;
    meeting.show(checked && holds);
    if (checked && holds) meeting.set(m.concurrent.point);

    if (checked && holds) {
      say("The three blue diagonals meet at one point — Brianchon's theorem holds here.", "done");
    } else if (checked) {
      say("Two tangents are almost parallel. Drag a dot away and check again.", null);
    } else {
      say("Drag the dots around the circle, then press Check the theorem.", null);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampToCircle = (q) => Core.projectToCircle(q, state.circle);
  const handles = {};
  names.forEach((n) => {
    handles[n] = board.handle(n, state.points[n], {
      r: 8, step: 3, shift: 12, layer: handlesLayer, clamp: clampToCircle,
      label: `Point ${n}. Drag around the circle, or focus and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, name) => {
        state = Core.withPoint(state, name, p);
        checked = false;
        render();
      },
    });
  });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    handles.A.node.focus();
  }
  function checkTheorem() {
    checked = true;
    render();
  }
  function toggleAddons() {
    state = Core.withOptions(state, { addons: !state.addons });
    addonsBtn.setAttribute("aria-pressed", String(state.addons));
    render();
  }
  function toggleExtend() {
    state = Core.withOptions(state, { drawLong: !state.drawLong });
    extendBtn.setAttribute("aria-pressed", String(state.drawLong));
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkTheorem);
  addonsBtn.addEventListener("click", toggleAddons);
  extendBtn.addEventListener("click", toggleExtend);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c" || k === "v") checkTheorem();
    else if (k === "a") toggleAddons();
    else if (k === "e") toggleExtend();
  });

  board.onTheme(render);
  render();
})();
