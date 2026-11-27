"use strict";

/*
 * Cy Quadri — drawing and input only.  The geometry is in cy-quadri-core.js:
 * four draggable corners A,B,C,D; the four internal or external angle
 * bisectors; the four points where neighbouring bisectors cross; and the
 * circle through those crossings that the applet draws.  Elements are made
 * once and only updated on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = CyQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const radios = {
    internal: document.getElementById("internal"),
    external: document.getElementById("external"),
  };
  const anglesBox = document.getElementById("angles");

  let state = Core.start();

  /* Back to front: circle, quadrilateral and bisectors, crossings, labels,
   * then the four focusable corner handles. */
  const back = board.layer("back");
  const lines = board.layer("lines");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circle = board.circle(state.A, 1, "circum", back);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", lines);
  // The applet draws two halves from each corner to its two crossings.
  const bisectors = [
    board.segment(state.A, state.B, "bisector", lines),
    board.segment(state.A, state.B, "bisector", lines),
    board.segment(state.B, state.C, "bisector", lines),
    board.segment(state.B, state.C, "bisector", lines),
    board.segment(state.C, state.D, "bisector", lines),
    board.segment(state.C, state.D, "bisector", lines),
    board.segment(state.D, state.A, "bisector", lines),
    board.segment(state.D, state.A, "bisector", lines),
  ];
  const keys = ["A", "B", "C", "D"];
  const neighbour = { A: ["D", "B"], B: ["A", "C"], C: ["B", "D"], D: ["C", "A"] };
  const arcs = {};
  for (const key of keys) {
    arcs[key] = [
      board.angleArc(state[key], state[neighbour[key][0]], state[key], 16, "angle-mark", marks),
      board.angleArc(state[key], state[neighbour[key][1]], state[key], 16, "angle-mark", marks),
    ];
  }
  const crossingDots = ["AB", "BC", "CD", "DA"].map((name) =>
    board.point(state.A, "crossing", 3.5, dots));
  const labels = {};
  for (const key of keys) labels[key] = board.label(state[key], key, "point-label", 8, -8, names);

  const handles = {};
  for (const key of keys) {
    handles[key] = board.handle(key, state[key], {
      r: 9, step: 5, shift: 15, layer: top, clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** The shared #status line also tells the progress tracker about the end. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of keys) handles[key].set(state[key]);

    if (!g) {
      circle.show(false);
      quad.show(false);
      for (const s of bisectors) s.show(false);
      for (const key of keys) for (const a of arcs[key]) a.show(false);
      for (const d of crossingDots) d.show(false);
      for (const key of keys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D, options: state.options });
      }
      return;
    }

    circle.show(true).set(g.circle.c, g.circle.r);
    quad.show(true).set([g.A, g.B, g.C, g.D]);

    // AB/DA at A, AB/BC at B, BC/CD at C, CD/DA at D, in the applet's order.
    const ends = [
      g.crossings.AB, g.crossings.DA,
      g.crossings.BC, g.crossings.AB,
      g.crossings.CD, g.crossings.BC,
      g.crossings.DA, g.crossings.CD,
    ];
    bisectors.forEach((s, i) => s.show(true).set(g[keys[Math.floor(i / 2)]], ends[i]));

    for (const key of keys) {
      const vertex = g[key];
      const ray = g.rays[key];
      // The external version reverses the second half of the drawn angle,
      // just as CyQuadriCanvas.Reverse does (2*ray - corner).
      const opposite = state.options.internal ? ray
        : { x: 2 * ray.x - vertex.x, y: 2 * ray.y - vertex.y };
      arcs[key][0].set(vertex, g[neighbour[key][0]], ray, 16);
      arcs[key][1].set(vertex, g[neighbour[key][1]], opposite, 16);
      for (const a of arcs[key]) a.show(state.options.angles);
    }

    ["AB", "BC", "CD", "DA"].forEach((name, i) =>
      crossingDots[i].show(true).set(g.crossings[name]));
    for (const key of keys) labels[key].show(true).set(g[key]);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        rays: g.rays, crossings: g.crossings, circle: g.circle,
        options: state.options, claims: g.claims,
      });
    }
  }

  for (const key of ["internal", "external"]) {
    radios[key].checked = (key === "internal") === state.options.internal;
    radios[key].addEventListener("change", () => {
      if (!radios[key].checked) return;
      state = Core.setOption(state, key, true);
      render();
    });
  }
  anglesBox.checked = state.options.angles;
  anglesBox.addEventListener("change", () => {
    state = Core.setOption(state, "angles", anglesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // Colours are CSS classes here, but keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
