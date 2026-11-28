"use strict";

/*
 * Inscribed Angle — the drawing and input, with all the geometry in
 * inscribed-angle-core.js.  A, B and C are draggable Geom handles restricted
 * to the circle, just as the applet's MoveablePoints are restricted to its
 * DoubCircle.  The two chords from A, the diameter through A′, the isosceles
 * proof arcs, the blue inscribed/central arcs and the tangent limit are all
 * made once and re-set on every redraw, so a handle keeps keyboard focus.
 * The only option in the old applet, "Show names", is a real checkbox.
 */

(function () {
  const Core = InscribedAngleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});
  const O = Core.CIRCLE.c;
  const theta = (p) => Math.atan2(p.y - O.y, p.x - O.x);

  /* Layers, back to front. */
  const back = board.layer("back");
  const proofLayer = board.layer("proof");
  const arcs = board.layer("arcs");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const circle = board.circle(O, Core.RADIUS, "circum", back);
  const chordAC = board.segment(state.A, state.C, "chord", back);
  const chordAB = board.segment(state.A, state.B, "chord", back);
  const diameter = board.segment(state.A, { x: 2 * O.x - state.A.x, y: 2 * O.y - state.A.y },
    "diameter", back);

  // Blue: the inscribed angle at A and the central angle over the same arc.
  const inscribedArc = board.angleArc(state.A, state.B, state.C, 30, "angle-main", arcs);
  const centralArc = board.arc(O, 34, 0, 0, "angle-main", arcs);
  const centralArc2 = board.arc(O, 34, 0, 0, "angle-main", arcs);

  // Red for B, green for C: the two isosceles triangles of the proof.
  const proofArcs = [];
  const proofRadii = [];
  for (const cls of ["angle-red", "angle-green"]) {
    proofRadii.push(board.segment(O, state.B, cls === "angle-red" ? "radius-red" : "radius-green", proofLayer));
    proofArcs.push([
      board.angleArc(state.B, state.A, state.B, 14, cls, proofLayer),
      board.angleArc(state.B, state.A, O, 20, cls, proofLayer),
      board.arc(O, 26, 0, 0, cls, proofLayer),
    ]);
  }

  // Tangent limit: tangent at A, the remaining radius, and four arcs.
  const tangentLine = board.line(state.A, state.A, "tangent", back);
  const tangentRadius = board.segment(O, state.C, "radius-green", proofLayer);
  const tangentArcs = [
    board.angleArc(state.A, O, state.C, 18, "angle-tangent", arcs),
    board.angleArc(state.C, O, state.A, 18, "angle-tangent", arcs),
    board.arc(O, 34, 0, 0, "angle-main", arcs),
    board.angleArc(state.A, state.C, state.A, 26, "angle-tangent", arcs),
  ];

  const dotO = board.point(O, "fixed-dot", 3.5, dots);
  const dotAp = board.point(state.A, "antipode-dot", 4, dots);
  const text = {};
  const offsets = { A: [-14, -12], B: [-16, -10], C: [-14, -12], O: [-14, 18], Ap: [-24, -10] };
  for (const name of Object.keys(offsets)) {
    text[name] = board.label(state.A, name === "Ap" ? "A′" : name,
      "point-label", offsets[name][0], offsets[name][1], labels);
  }

  function say(message, kind) {
    statusEl.textContent = message;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const handleLabels = {
    A: "Point A, where the two chords meet. Drag it, or focus it and use the arrow keys.",
    B: "Point B on the circle. Drag it, or focus it and use the arrow keys.",
    C: "Point C on the circle. Drag it, or focus it and use the arrow keys.",
  };
  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 10,
      step: 4,
      shift: 12,
      layer: handlesLayer,
      label: handleLabels[name],
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y)
        + ". Move it round the circle with the arrow keys.",
      clamp: (p) => Core.project(p),
      onMove: (p, which) => {
        state = Core.move(state, which, p);
        render();
      },
    });
  }

  /** Redraw every object from the core, speak the result and save the position. */
  function render() {
    const g = Core.geometry(state);
    for (const name of Core.HANDLES) handles[name].set(state[name]);

    circle.set(O, Core.RADIUS);
    diameter.set(g.A, g.Ap);
    dotAp.set(g.Ap);
    dotAp.show(g.mode === "normal");
    dotO.set(O);

    // ShowNames in the applet draws A always, and B or C only while it is
    // not sitting on top of A.
    text.A.set(g.A).show(state.names);
    text.B.set(g.B).show(state.names && g.dAB > 1);
    text.C.set(g.C).show(state.names && g.dAC > 1);
    text.O.set(O).show(state.names);
    text.Ap.set(g.Ap).show(state.names && g.mode === "normal");

    if (g.mode === "normal") {
      chordAC.set(g.A, g.C).show(true);
      chordAB.set(g.A, g.B).show(true);
      inscribedArc.set(g.A, g.B, g.C, 30).show(true);
      if (g.split) {
        centralArc.set(O, 34, theta(g.B), theta(g.Ap)).show(true);
        centralArc2.set(O, 34, theta(g.Ap), theta(g.C)).show(true);
      } else {
        centralArc.set(O, 34, theta(g.B), theta(g.C)).show(true);
        centralArc2.show(false);
      }

      g.proof.forEach((part, index) => {
        const on = part.show;
        proofRadii[index].set(O, part.P).show(on);
        proofArcs[index][0].set(part.P, g.A, g.Ap, 14).show(on);
        proofArcs[index][1].set(part.P, g.A, O, 20).show(on);
        proofArcs[index][2].set(O, 26, theta(part.P), theta(g.Ap)).show(on);
      });
      tangentRadius.show(false);
      tangentLine.show(false);
      for (const arc of tangentArcs) arc.show(false);
    } else {
      chordAC.show(false);
      chordAB.show(false);
      inscribedArc.show(false);
      centralArc.show(false);
      centralArc2.show(false);
      for (let i = 0; i < g.proof.length; i++) {
        proofRadii[i].show(false);
        for (const arc of proofArcs[i]) arc.show(false);
      }
      const Q = g.tangent.chordPoint;
      tangentLine.set(g.A, g.tangent.T).show(true);
      tangentRadius.set(O, Q).show(true);
      tangentArcs[0].set(g.A, O, Q, 18).show(true);
      tangentArcs[1].set(Q, O, g.A, 18).show(true);
      tangentArcs[2].set(O, 34, theta(g.A), theta(Q)).show(true);
      tangentArcs[3].set(g.A, Q, g.tangent.chosen, 26).show(true);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    if (window.Track) window.Track.state(state);
  }

  namesBox.checked = state.names;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // Classes take their colours from the site tokens; redraw anyway so the
  // picture and the spoken description stay in step with a theme flip.
  board.onTheme(() => render());
  render();
})();
