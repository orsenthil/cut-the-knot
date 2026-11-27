"use strict";

/*
 * Eight Point Circle — drawing and input only. The geometry lives in
 * eight-point-circle-core.js: four corner handles A,B,C,D with perpendicular
 * diagonals, the side midpoints P,Q,R,S, the perpendicular feet E,F,G,H, the
 * centre K and the circle through all eight points. The three checkboxes are
 * the applet's "Show diagonals", "Show labels" and "Show hint"; Reset restores
 * its starting picture. Shapes are created once and only updated on a redraw,
 * so a handle keeps keyboard focus.
 */

(function () {
  const Core = EightPointCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    diagonals: document.getElementById("showDiagonals"),
    labels: document.getElementById("showLabels"),
    hint: document.getElementById("showHint"),
  };

  let state = Core.start();

  /* Layers, back to front. */
  const spokesLayer = board.layer("spokes");
  const circleLayer = board.layer("circle");
  const diagLayer = board.layer("diagonals");
  const sideLayer = board.layer("sides");
  const dropLayer = board.layer("drops");
  const hintLayer = board.layer("hint");
  const dotsLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const spokePairs = ["AF", "AG", "BG", "BH", "CH", "CE", "DE", "DF"];
  const spokes = spokePairs.map(() => board.segment(state.A, state.B, "spoke", spokesLayer));
  const circle = board.circle(state.A, 1, "eight-circle", circleLayer);
  const diagonals = [0, 1].map(() => board.segment(state.A, state.B, "diagonal", diagLayer));
  const sides = board.polygon([state.A, state.B, state.C, state.D], "side", sideLayer);
  const drops = [0, 1, 2, 3].map(() => board.segment(state.A, state.B, "drop", dropLayer));
  const hintDiameters = [0, 1].map(() => board.segment(state.A, state.B, "hint-diameter", hintLayer));
  const hintSides = [0, 1, 2, 3].map(() => board.segment(state.A, state.B, "hint-rect", hintLayer));

  const dotKeys = ["P", "Q", "R", "S", "E", "F", "G", "H", "K"];
  const dotClasses = {
    P: "midpoint", Q: "midpoint", R: "midpoint", S: "midpoint",
    E: "foot", F: "foot", G: "foot", H: "foot", K: "centre",
  };
  const dots = {};
  for (const key of dotKeys) {
    dots[key] = board.point(state.A, dotClasses[key], key === "K" ? 5 : 4, dotsLayer);
  }

  const labelKeys = ["A", "B", "C", "D"].concat(dotKeys);
  const offsets = {
    A: [-14, -9], B: [-16, -9], C: [8, 16], D: [8, -9],
    P: [-15, -9], Q: [7, -9], R: [7, 16], S: [-16, 16],
    E: [7, 15], F: [-16, -9], G: [7, -8], H: [-16, 15], K: [7, -8],
  };
  const labelEls = {};
  for (const key of labelKeys) {
    const d = offsets[key];
    labelEls[key] = board.label(state.A, key, "point-label", d[0], d[1], labelLayer);
  }

  const cornerKeys = ["A", "B", "C", "D"];
  const handles = {};
  for (const key of cornerKeys) {
    handles[key] = board.handle(key, state[key], {
      r: 9, step: 5, shift: 15, layer: handleLayer,
      clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys; its opposite corner follows to keep the diagonals perpendicular.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of cornerKeys) handles[key].set(state[key]);

    if (!g) {
      for (const s of spokes.concat(diagonals, [circle, sides], drops,
        hintDiameters, hintSides)) s.show(false);
      for (const key of dotKeys) dots[key].show(false);
      for (const key of labelKeys) labelEls[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D,
          options: state.options });
      }
      return;
    }

    const byName = Object.assign({}, g, {
      A: g.A, B: g.B, C: g.C, D: g.D,
    });
    for (let i = 0; i < spokes.length; i++) {
      const pair = spokePairs[i];
      spokes[i].set(byName[pair[0]], byName[pair[1]]).show(true);
    }
    circle.set(g.K, g.radius).show(true);
    for (let i = 0; i < diagonals.length; i++) {
      diagonals[i].set(g.diagonals[i][0], g.diagonals[i][1]).show(state.options.diagonals);
    }
    sides.set(g.sides.map((s) => s[0])).show(true);
    for (let i = 0; i < drops.length; i++) {
      drops[i].set(g.drops[i][0], g.drops[i][1]).show(true);
    }
    for (let i = 0; i < hintDiameters.length; i++) {
      hintDiameters[i].set(g.hintLines[i][0], g.hintLines[i][1]).show(state.options.hint);
    }
    for (let i = 0; i < hintSides.length; i++) {
      hintSides[i].set(g.hintLines[i + 2][0], g.hintLines[i + 2][1]).show(state.options.hint);
    }
    for (const key of dotKeys) {
      dots[key].set(g[key]).show(key === "K" || state.options.labels);
    }
    for (const key of labelKeys) {
      labelEls[key].set(g[key]).show(key === "K" || state.options.labels);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        P: g.P, Q: g.Q, R: g.R, S: g.S,
        E: g.E, F: g.F, G: g.G, H: g.H, K: g.K,
        radius: g.radius, options: state.options, claims: g.claims,
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
