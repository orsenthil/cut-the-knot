"use strict";

/*
 * DeTemple — drawing and input only. detemple-core.js computes every point:
 * the four exterior angle bisectors meet in E,F,G,H on one circle, the
 * perpendiculars to the sides meet in P,Q,R,S, and both blue circles share
 * a centre. Shapes are made once and only updated on a redraw, so a focused
 * handle keeps the keyboard focus. The three checkboxes mirror the applet's
 * "names", "hint 1" and "hint 2".
 */

(function () {
  const Core = DetempleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    names: document.getElementById("names"),
    hint1: document.getElementById("hint1"),
    hint2: document.getElementById("hint2"),
  };

  let state = Core.start();

  /* Layers, back to front. */
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* The two circles and the four lines of each family. */
  const bigCircle = board.circle(state.A, 1, "circum", circles);
  const smallCircle = board.circle(state.A, 1, "incircle", circles);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  const sides = [0, 1, 2, 3].map(() => board.segment(state.A, state.B, "side", guides));
  const bisectors = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "bisector", guides));
  const perpendiculars = [0, 1, 2, 3].map(() => board.line(state.A, state.B, "perp", guides));

  /* Points, their tangency feet and the marked centre. */
  const outerDots = [0, 1, 2, 3].map(() => board.point(state.A, "outer-point", 4, dots));
  const innerDots = [0, 1, 2, 3].map(() => board.point(state.A, "inner-point", 4, dots));
  const footDots = [0, 1, 2, 3].map(() => board.point(state.A, "foot-point", 3, dots));
  const tangentDots = [0, 1, 2, 3].map(() => board.point(state.A, "tangent-point", 3, dots));
  const centreDot = board.point(state.A, "centre-dot", 3.5, dots);

  /* Hint 1: right angles at the feet and the four numbered exterior angles. */
  const footAngles = [0, 1, 2, 3].map(() => board.rightAngle(state.A, state.B, state.C, 8, "hint-right", marks));
  const cornerArcs = [0, 1, 2, 3].map(() => board.angleArc(state.A, state.B, state.C, 15, "hint-arc", marks));

  /* Hint 2: right angles where PQRS touches EFGH, and the drawn radii. */
  const tangentAngles = [0, 1, 2, 3].map(() => board.rightAngle(state.A, state.B, state.C, 8, "hint-right", marks));
  const radii = [0, 1, 2, 3].map(() => board.segment(state.A, state.B, "hint-radius", marks));

  const names = {};
  for (const key of ["A", "B", "C", "D", "E", "F", "G", "H", "P", "Q", "R", "S", "O", "1", "2", "3", "4"]) {
    names[key] = board.label(state.A, key, "point-label", 7, -7, labelsLayer);
  }

  const handles = {};
  for (const key of ["A", "B", "C", "D"]) {
    handles[key] = board.handle(key, state[key], {
      r: 9, step: 5, shift: 15, layer: handlesLayer,
      clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** The status line is also how the player's record sees an explored demo. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Put a shape at a point, or hide it when the drawing is undefined. */
  function place(shape, p, on) {
    if (on && p) shape.show(true).set(p);
    else shape.show(false);
    return shape;
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "C", "D"]) handles[key].set(state[key]);

    if (!g) {
      for (const s of [bigCircle, smallCircle, quad, centreDot]
        .concat(sides, bisectors, perpendiculars, outerDots, innerDots, footDots,
          tangentDots, footAngles, cornerArcs, tangentAngles, radii)) s.show(false);
      for (const key of Object.keys(names)) names[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ corners: { A: state.A, B: state.B, C: state.C, D: state.D }, options: state.options });
      return;
    }

    bigCircle.show(true).set(g.big.c, g.big.r);
    smallCircle.show(true).set(g.small.c, g.small.r);
    quad.show(true).set([g.A, g.B, g.C, g.D]);
    const corners = [g.A, g.B, g.C, g.D];
    const outer0 = [g.E, g.F, g.G, g.H], feet0 = [g.feet.E, g.feet.F, g.feet.G, g.feet.H];
    for (let i = 0; i < 4; i++) {
      sides[i].show(true).set(corners[i], corners[(i + 1) % 4]);
      bisectors[i].show(true).set(g.bisectors["ABCD"[i]].a, g.bisectors["ABCD"[i]].b);
      perpendiculars[i].show(true).set(outer0[i], feet0[i]);
    }

    const outer = outer0, inner = [g.P, g.Q, g.R, g.S];
    const feet = feet0;
    const tangency = [g.tangency.P, g.tangency.Q, g.tangency.R, g.tangency.S];
    for (let i = 0; i < 4; i++) {
      place(outerDots[i], outer[i], true);
      place(innerDots[i], inner[i], true);
      place(footDots[i], feet[i], state.options.hint1);
      place(tangentDots[i], tangency[i], state.options.hint2);
      if (state.options.hint1) {
        footAngles[i].show(true).set(feet[i], outer[i], corners[i], 8);
        const v = corners[i], hit = g.bisectors["ABCD"[i]].b;
        cornerArcs[i].show(true).set(v, corners[(i + 1) % 4], hit, 15);
      } else {
        footAngles[i].show(false);
        cornerArcs[i].show(false);
      }
      if (state.options.hint2) {
        const sideA = outer[i], sideB = outer[(i + 1) % 4];
        tangentAngles[i].show(true).set(tangency[i], sideB, g.big.c, 8);
        radii[i].show(true).set(inner[i], tangency[i]);
      } else {
        tangentAngles[i].show(false);
        radii[i].show(false);
      }
    }
    place(centreDot, g.big.c, true);

    const positions = {
      A: g.A, B: g.B, C: g.C, D: g.D,
      E: g.E, F: g.F, G: g.G, H: g.H,
      P: g.P, Q: g.Q, R: g.R, S: g.S, O: g.big.c,
    };
    for (const key of Object.keys(names)) {
      if (["1", "2", "3", "4"].includes(key)) {
        names[key].show(state.options.hint1);
        if (state.options.hint1) names[key].set(positions["ABCD"[Number(key) - 1]], key, 16, 16);
      } else {
        names[key].show(state.options.names);
        if (state.options.names) names[key].set(positions[key]);
      }
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        corners: { A: g.A, B: g.B, C: g.C, D: g.D },
        outer: { E: g.E, F: g.F, G: g.G, H: g.H },
        inner: { P: g.P, Q: g.Q, R: g.R, S: g.S },
        big: g.big, small: g.small, options: state.options, claims: g.claims,
      });
    }
  }

  for (const key of Object.keys(boxes)) {
    boxes[key].checked = state.options[key];
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const key of Object.keys(boxes)) boxes[key].checked = state.options[key];
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
