"use strict";

/*
 * The page for Connes: drawing and input only; the mathematics lives in
 * connes-core.js. The SVG shows the triangle A, B, C about its origin O, the
 * two rotated copies B1 (a turn of 120 degrees) and C1 (a turn the other way),
 * and the red sum dot S = B1 + C1 + A measured from O. "Show vector sums"
 * adds the parallelogram that carries the two rotated vectors to their sum.
 * Dragging or arrow-keying a corner updates the picture and the residue of
 * A + jB + j^2 C; nothing can be won or lost here.
 */

(function () {
  const Core = ConnesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");
  const vectorsBtn = document.getElementById("vectorsBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start({});

  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  // Every object is built once. render() only moves it or shows and hides it,
  // so a handle keeps its keyboard focus when the picture changes.
  const fill = board.polygon([state.A, state.B, state.C], "tri-fill", shapes);
  const sides = [0, 1, 2].map(() => board.segment(state.A, state.B, "tri-side", shapes));
  const radii = [
    board.segment(state.O, state.B, "radius", shapes),
    board.segment(state.O, state.C, "radius", shapes),
  ];
  const rotated = [
    board.segment(state.O, state.B, "rotated", shapes),
    board.segment(state.O, state.C, "rotated", shapes),
  ];
  const closure = [
    board.segment(state.B, state.A, "closure", shapes),
    board.segment(state.A, state.C, "closure", shapes),
  ];
  const vSides = [
    board.segment(state.B, state.O, "vector-sum", shapes),
    board.segment(state.C, state.O, "vector-sum", shapes),
  ];
  const sumVector = board.segment(state.O, state.O, "sum-vector", shapes);
  const aVector = board.segment(state.O, state.A, "a-vector", shapes);
  const toA = board.segment(state.O, state.A, "sum-to-a", shapes);

  const arcs = [
    board.arc(state.O, 30, 0, 1, "turn-arc", marks),
    board.arc(state.O, 44, 0, 1, "turn-arc alt", marks),
  ];
  const dots = {
    O: board.point(state.O, "o-dot", 4, marks),
    S: board.point(state.O, "sum-dot", 5, marks),
    P: board.point(state.O, "corner-dot", 4, marks),
  };
  const labels = {
    A: board.label(state.A, "A", "glabel", -18, 24, marks),
    B: board.label(state.B, "B", "glabel", -8, -12, marks),
    C: board.label(state.C, "C", "glabel", -8, 24, marks),
    O: board.label(state.O, "O", "glabel origin-label", -17, -10, marks),
    B1: board.label(state.B, "B₁", "glabel rotated-label", 7, -8, marks),
    C1: board.label(state.C, "C₁", "glabel rotated-label", 7, 19, marks),
    S: board.label(state.O, "S", "glabel sum-label", 8, -9, marks),
    P: board.label(state.O, "B₁+C₁", "glabel corner-label", 7, -9, marks),
  };

  /**
   * Shows a line under the diagram. "done" is the class the player's record
   * reads when an illustration has been explored; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.compute(state);
    const cl = Core.claims(state);
    const O = state.O;

    fill.set([state.A, state.B, state.C]);
    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    radii[0].set(O, state.B);
    radii[1].set(O, state.C);
    rotated[0].set(O, m.B1);
    rotated[1].set(O, m.C1);
    closure[0].set(m.B1, state.A);
    closure[1].set(state.A, m.C1);
    aVector.set(O, state.A);
    toA.set(m.sumDot, state.A);

    // The two arcs turn in opposite directions, as in the applet.
    const bAngle = Math.atan2(state.B.y - O.y, state.B.x - O.x);
    const cAngle = Math.atan2(state.C.y - O.y, state.C.x - O.x);
    arcs[0].set(O, 30, bAngle, bAngle + m.sign * Core.TURN);
    arcs[1].set(O, 44, cAngle, cAngle - m.sign * Core.TURN);

    const show = Boolean(state.showVectors);
    vSides[0].set(m.B1, m.corner);
    vSides[1].set(m.C1, m.corner);
    vSides.forEach((line) => line.show(show));
    sumVector.set(O, m.corner);
    sumVector.show(show);
    dots.P.set(m.corner);
    dots.P.show(show);
    labels.P.set(m.corner);
    labels.P.show(show);

    dots.O.set(O);
    dots.S.set(m.sumDot);
    labels.O.set(O);
    labels.S.set(m.sumDot);
    labels.B1.set(m.B1);
    labels.C1.set(m.C1);
    labels.A.set(state.A);
    labels.B.set(state.B);
    labels.C.set(state.C);

    if (cl.criterion) {
      say("S is on O: A + jB + j²C = 0, so the triangle is equilateral.", "done");
    } else {
      say(`A + jB + j²C = (${fmt(m.criterion.x)}, ${fmt(m.criterion.y)}); S is ${Math.round(Core.distance(m.sumDot, O))} units from O. Make an equilateral triangle to put S on O.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const opts = {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  const handles = {
    A: board.handle("A", state.A, {
      ...opts,
      label: "Corner A. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p) => moveVertex("A", p),
    }),
    B: board.handle("B", state.B, {
      ...opts,
      label: "Corner B. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p) => moveVertex("B", p),
    }),
    C: board.handle("C", state.C, {
      ...opts,
      label: "Corner C. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p) => moveVertex("C", p),
    }),
  };

  function syncButton() {
    vectorsBtn.setAttribute("aria-pressed", String(state.showVectors));
    vectorsBtn.textContent = state.showVectors ? "Hide vector sums" : "Show vector sums";
  }

  function setPreset(makeEquilateral) {
    state = makeEquilateral ? Core.equilateralPreset(state) : Core.start({});
    Object.keys(handles).forEach((name) => handles[name].set(state[name]));
    syncButton();
    render();
    handles.A.node.focus();
  }

  function toggleVectors() {
    state = Core.withOption(state, "showVectors", !state.showVectors);
    syncButton();
    render();
  }

  newBtn.addEventListener("click", () => setPreset(true));
  resetBtn.addEventListener("click", () => setPreset(false));
  vectorsBtn.addEventListener("click", toggleVectors);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "e") setPreset(true);
    else if (k === "r") setPreset(false);
    else if (k === "v") toggleVectors();
  });

  board.onTheme(render);
  syncButton();
  render();
})();
