"use strict";

/*
 * Angle On Diameter — the drawing and input, with all the geometry in
 * angle-on-diameter-core.js.  A, B and O are fixed; P is the only draggable
 * point and is kept on the circle.  The diameter, the two chords PA and PB,
 * the optional radius OP, the right-angle mark and the coloured angle arcs
 * are redrawn from the core on every move.  The controls reproduce the old
 * applet's "Show names" checkbox and its names/statement/hint/plain choices.
 */

(function () {
  const Core = AngleOnDiameterCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const modeRadios = Array.from(document.querySelectorAll('input[name="mode"]'));
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({ names: true, mode: "plain" });
  const circle = Core.CIRCLE;

  /* Layers, back to front: the circle and chords, the angle marks, the fixed
   * dots and labels, then the handle that stays on top and keeps focus. */
  const back = board.layer("back");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circum = board.circle(circle.c, circle.r, "circum", back);
  const diameter = board.segment(Core.point(Core.CENTER.x - Core.RADIUS, Core.CENTER.y),
    Core.point(Core.CENTER.x + Core.RADIUS, Core.CENTER.y), "diameter", back);
  const chordA = board.segment(state.P, Core.point(0, 0), "chord", back);
  const chordB = board.segment(state.P, Core.point(0, 0), "chord", back);
  const radius = board.segment(state.P, circle.c, "radius", back);

  // The right-angle square at P, and the six arcs of the old page's chase.
  const corner = board.rightAngle(state.P, state.P, state.P, 14, "corner", marks);
  const arcs = [
    board.angleArc(state.P, state.P, state.P, 18, "angle-blue", marks),   // ∠PAO
    board.angleArc(state.P, state.P, state.P, 18, "angle-blue", marks),   // ∠OPA
    board.angleArc(state.P, state.P, state.P, 22, "central-blue", marks), // ∠POB
    board.angleArc(state.P, state.P, state.P, 18, "angle-red", marks),    // ∠OBP
    board.angleArc(state.P, state.P, state.P, 18, "angle-red", marks),    // ∠BPO
    board.angleArc(state.P, state.P, state.P, 22, "central-red", marks),  // ∠POA
  ];

  const dotA = board.point(Core.point(0, 0), "fixed-dot", 4, dots);
  const dotB = board.point(Core.point(0, 0), "fixed-dot", 4, dots);
  const dotO = board.point(circle.c, "fixed-dot", 4, dots);
  const labels = {};
  for (const key of ["A", "B", "O", "P"]) {
    labels[key] = board.label(state.P, key, "point-label", -16, -12, names);
  }

  const handleP = board.handle("P", state.P, {
    step: 5, shift: 15, r: 10, layer: top,
    label: "Point P on the circle. Drag it, or focus it and use the arrow keys to move it round the circle.",
    describe: (p) => `at (${Math.round(p.x)}, ${Math.round(p.y)}). The angle at P stays 90 degrees.`,
    clamp: (p) => Core.clamp(p),
    onMove: (p) => {
      state = Core.move(state, p);
      render();
    },
  });

  /** `#status` is how the player's record sees an explored picture. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const mode = state.options.mode;
    handleP.set(g.P);

    circum.set(g.circle.c, g.circle.r);
    diameter.set(g.A, g.B);
    chordA.set(g.P, g.A);
    chordB.set(g.P, g.B);
    radius.set(g.P, g.O);
    radius.show(mode === "hint");

    corner.set(g.P, g.A, g.B, 14);
    corner.show(mode === "statement");

    // Hint mode: the two isosceles triangles, exactly as the old applet draws
    // them (blue on the A side, red on the B side, with the central angles).
    arcs[0].set(g.A, g.P, g.O, 18);
    arcs[1].set(g.P, g.O, g.A, 18);
    arcs[2].set(g.O, g.P, g.B, 22);
    arcs[3].set(g.B, g.O, g.P, 18);
    arcs[4].set(g.P, g.B, g.O, 18);
    arcs[5].set(g.O, g.P, g.A, 22);
    for (const arc of arcs) arc.show(mode === "hint");

    dotA.set(g.A);
    dotB.set(g.B);
    dotO.set(g.O);
    labels.A.set(g.A);
    labels.B.set(g.B);
    labels.O.set(g.O);
    labels.P.set(g.P);
    // The applet hides the P label when P lands on A or B.
    labels.P.show(state.options.names && Core.dist(g.P, g.A) > 1 && Core.dist(g.P, g.B) > 1);
    labels.A.show(state.options.names);
    labels.B.show(state.options.names);
    labels.O.show(state.options.names);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        P: g.P, A: g.A, B: g.B, O: g.O, circle: g.circle,
        angles: g.angles, options: state.options,
      });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  for (const radio of modeRadios) {
    radio.addEventListener("change", () => {
      if (radio.checked) {
        state = Core.setOption(state, "mode", radio.value);
        render();
      }
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    for (const radio of modeRadios) radio.checked = radio.value === state.options.mode;
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
