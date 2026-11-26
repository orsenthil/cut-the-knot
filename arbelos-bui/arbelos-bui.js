"use strict";

/*
 * The drawing and input for Arbelos Bui.  All the construction is in
 * arbelos-bui-core.js; this file only puts the points, arcs, twin circles and
 * guide lines on an SVG board.  A, B and C are draggable handles on the
 * baseline; the three checkboxes reproduce the applet's "names",
 * "proposition" and "hint" show options, and Reset restores its starting figure.
 */

(function () {
  const Core = ArbelosBuiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const propositionBox = document.getElementById("proposition");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: filled twin circles, the three semicircles and
   * their baseline, the construction lines, the highlighted chords, small
   * dots, point names, then the handles that keep keyboard focus. */
  const fills = board.layer("fills");
  const arcs = board.layer("arcs");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const fill1 = board.circle({ x: 0, y: 0 }, 1, "twin-fill", fills);
  const fill2 = board.circle({ x: 0, y: 0 }, 1, "twin-fill", fills);
  const bigArc = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc arc-big", arcs);
  const arc1 = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc", arcs);
  const arc2 = board.arc({ x: 0, y: 0 }, 1, Math.PI, 2 * Math.PI, "arc", arcs);
  const baseline = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "baseline", arcs);

  const rayLines = [
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray", guides),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray", guides),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray", guides),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray", guides),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray ray-centre", guides),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "ray ray-centre", guides),
  ];
  const diameters = [
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "diameter", marks),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "diameter", marks),
  ];
  const equalLines = [
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "equal-line", marks),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "equal-line", marks),
  ];
  const hintLines = [
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", marks),
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", marks),
  ];

  const dotKeys = ["O", "O1", "O2", "D1", "D2", "E1", "E2", "F1", "F2", "K1", "K2"];
  const dotStyle = { D1: "dot-d", D2: "dot-d", K1: "dot-k", K2: "dot-k" };
  const dotsByKey = {};
  for (const key of dotKeys) {
    dotsByKey[key] = board.point({ x: 0, y: 0 }, dotStyle[key] || "dot", 3.5, dots);
  }

  const labelOffsets = {
    A: [-6, 19], B: [-6, 19], C: [-5, 19],
    D1: [-8, -9], D2: [7, -9],
    E1: [-17, 5], E2: [7, 5], F1: [4, 5], F2: [-17, 5],
    O: [-5, 19], O1: [-13, 19], O2: [-13, 19], K1: [6, -7], K2: [-22, -7],
  };
  const labelText = {
    A: "A", B: "B", C: "C", D1: "D₁", D2: "D₂",
    E1: "E₁", E2: "E₂", F1: "F₁", F2: "F₂",
    O: "O", O1: "O₁", O2: "O₂", K1: "K₁", K2: "K₂",
  };
  const labels = {};
  for (const key of Object.keys(labelText)) {
    const off = labelOffsets[key];
    labels[key] = board.label({ x: 0, y: 0 }, labelText[key], "point-label", off[0], off[1], names);
  }

  const handleLabel = {
    A: "Point A, left end of the baseline",
    B: "Point B, right end of the baseline",
    C: "Point C, the dividing point",
  };
  const handleOpts = (name) => ({
    label: handleLabel[name],
    r: 8, step: 5, shift: 15, layer: top,
    clamp: (q, which) => Core.project(state, which, q),
    describe: (p) => "at x = " + Math.round(p.x) + ", on the baseline",
    onMove: (p, which) => {
      state = Core.move(state, which, p);
      render();
    },
  });
  const handles = {
    A: board.handle("A", state.A, handleOpts("A")),
    B: board.handle("B", state.B, handleOpts("B")),
    C: board.handle("C", state.C, handleOpts("C")),
  };

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);

    fill1.set(g.k1.c, g.k1.r);
    fill2.set(g.k2.c, g.k2.r);
    bigArc.set(g.big.c, g.big.r, Math.PI, 2 * Math.PI);
    arc1.set(g.c1.c, g.c1.r, Math.PI, 2 * Math.PI);
    arc2.set(g.c2.c, g.c2.r, Math.PI, 2 * Math.PI);
    baseline.set(g.A, g.B);

    rayLines[0].set(g.A, g.D1);
    rayLines[1].set(g.C, g.D1);
    rayLines[2].set(g.B, g.D2);
    rayLines[3].set(g.C, g.D2);
    rayLines[4].set(g.D1, g.O1);
    rayLines[5].set(g.D2, g.O2);

    diameters[0].set(g.E1, g.F1);
    diameters[1].set(g.E2, g.F2);
    equalLines[0].set(g.K1, g.O);
    equalLines[1].set(g.K2, g.O);
    hintLines[0].set(g.E1, g.C);
    hintLines[1].set(g.D1, g.B);
    // The applet hides the equal-distance strokes when "hint" is on, and
    // shows the parallel hint instead.
    for (const line of equalLines) line.show(state.options.proposition && !state.options.hint);
    for (const line of hintLines) line.show(state.options.hint);
    for (const line of diameters) line.show(state.options.proposition);
    for (const line of rayLines) line.show(true);
    for (const key of dotKeys) dotsByKey[key].set(g[key]);
    for (const key of Object.keys(labels)) {
      labels[key].set(g[key]);
      labels[key].show(state.options.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, O: g.O, O1: g.O1, O2: g.O2,
        D1: g.D1, D2: g.D2, E1: g.E1, E2: g.E2, F1: g.F1, F2: g.F2,
        K1: g.K1, K2: g.K2, G1: g.G1, H1: g.H1, G2: g.G2, H2: g.H2,
        circles: { big: g.big, small1: g.c1, small2: g.c2, twin1: g.k1, twin2: g.k2 },
        r1: g.r1, r2: g.r2, radius: g.rho,
        k1o: g.k1o, k2o: g.k2o, chords: [g.span1, g.span2],
        options: state.options,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("proposition", propositionBox);
  toggle("hint", hintBox);

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
