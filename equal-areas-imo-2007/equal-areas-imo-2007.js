"use strict";

/*
 * The page for EqualAreasIMO2007: drawing and input only. The construction
 * and the equal-area check live in equal-areas-imo-2007-core.js. Three Geom
 * handles drag the corners A, B and C; two tick boxes reproduce the applet's
 * "names" and "details" switches; Reset brings back the opening triangle.
 * The two shaded triangles are RPK and RQL — the applet colours both cyan.
 */

(() => {
  const Core = EqualAreas2007Core;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    fills: board.layer("fills"),
    guides: board.layer("guides"),
    circle: board.layer("circle"),
    triangle: board.layer("triangle"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** The status line; a demo reports "done" rather than a win or a loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fillRPK = board.polygon([state.A, state.B, state.C], "shaded-area", layers.fills);
  const fillRQL = board.polygon([state.A, state.B, state.C], "shaded-area", layers.fills);
  const circum = board.circle(state.A, 50, "circumcircle", layers.circle);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);
  const bisector = board.line(state.C, state.R || state.A, "bisector", layers.guides);
  const perpK = board.line(state.K || state.A, state.A, "perp-bisector", layers.guides);
  const perpL = board.line(state.L || state.A, state.A, "perp-bisector", layers.guides);
  const radii = [0, 1].map(() => board.segment(state.A, state.B, "radius-line", layers.marks));
  const angleMark = board.angleArc(state.C, state.A, state.B, 26, "angle-mark", layers.marks);

  const dotNames = ["K", "L", "P", "Q", "R", "O"];
  const dots = Object.fromEntries(dotNames.map((name) =>
    [name, board.point(state.A, name === "O" ? "center-dot" : "construct-dot",
      name === "R" ? 5 : 4, layers.dots)]));

  const labelOffsets = {
    A: [-13, -9], B: [8, -9], C: [-4, 19], K: [-15, 18], L: [-15, 18],
    P: [-17, -9], Q: [7, -9], R: [8, -8], O: [7, -8],
  };
  const labels = Object.fromEntries(Object.entries(labelOffsets).map(([name, off]) =>
    [name, board.label(state.A, name, "point-label", off[0], off[1], layers.labels)]));

  const handles = {};
  for (const name of Core.CORNERS) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 3,
      shift: 5,
      cls: "geom-handle corner-handle",
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at board position ${Math.round(p.x)}, ${Math.round(p.y)}.`,
      // Geom's keyboard handler needs a point back even for a refused drag.
      clamp: (q) => Core.clampHandle(name, q, state) || state[name],
      onMove: (p, which) => apply({ type: "point", name: which, point: p },
        `Moved point ${which}.`),
    });
  }

  function statusText() {
    if (geometry.degenerate) return "Spread the corners out so they make a triangle.";
    const g = geometry;
    const difference = g.areaGap < 1e-6 * Math.max(1, g.areaRPK);
    const first = g.areaRPK.toFixed(1), second = g.areaRQL.toFixed(1);
    return `Triangle RPK covers ${first} square units and triangle RQL covers ${second}. `
      + (difference ? "They are equal — the line from C through R keeps them that way."
        : "They differ by a tiny rounding amount.")
      + ` Angle C is ${(g.angleC * 180 / Math.PI).toFixed(1)} degrees. `
      + (state.details ? "Dashed lines show the perpendicular bisectors of BC and AC."
        : "Tick details to see the two perpendicular bisectors.");
  }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    for (const name of Core.CORNERS) handles[name].set(state[name]);
    for (const name of ["A", "B", "C"]) labels[name].set(state[name]).show(state.showNames);

    if (geometry.degenerate) {
      for (const shape of [fillRPK, fillRQL, circum, bisector, perpK, perpL, angleMark,
        ...radii, ...Object.values(dots)]) shape.show(false);
      for (const name of dotNames) labels[name].show(false);
      return;
    }

    const g = geometry;
    fillRPK.set([g.R, g.P, g.K]).show(true);
    fillRQL.set([g.R, g.Q, g.L]).show(true);
    circum.set(g.O, g.radius).show(true);
    bisector.set(g.C, g.R).show(true);
    perpK.set(g.K, g.O).show(state.details);
    perpL.set(g.L, g.O).show(state.details);
    angleMark.set(g.C, g.A, g.B, 26).show(true);
    radii[0].set(g.O, g.R).show(state.details);
    radii[1].set(g.O, g.C).show(state.details);

    const spots = { K: g.K, L: g.L, P: g.P, Q: g.Q, R: g.R, O: g.O };
    dots.O.set(g.O).show(state.details);
    labels.O.set(g.O).show(state.showNames && state.details);
    for (const name of ["K", "L", "P", "Q", "R"]) {
      dots[name].set(spots[name]).show(true);
      labels[name].set(spots[name]).show(state.showNames);
    }
  }

  /** Redraw, speak the result, and save the position for the tutor. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  function apply(move, note) {
    const next = Core.move(state, move);
    if (!next) {
      say("That spot would flatten the triangle. Try another one.");
      return false;
    }
    state = next;
    render();
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const boxes = {
    showNames: document.getElementById("namesBox"),
    details: document.getElementById("detailsBox"),
  };
  for (const key of Object.keys(boxes)) {
    boxes[key].checked = state[key];
    boxes[key].addEventListener("change", () => {
      apply({ type: "option", key, value: boxes[key].checked },
        boxes[key].checked ? "Showing " + boxes[key].dataset.label + "."
          : "Hid " + boxes[key].dataset.label + ".");
      // A refused move cannot happen here, but keep the tick in step.
      boxes[key].checked = state[key];
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening triangle.");
  });

  board.onTheme(() => draw());
  render();
})();
