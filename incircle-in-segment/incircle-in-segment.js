"use strict";

/*
 * The drawing and input for Circle Inscribed in a Circular Segment. All the
 * geometry is in incircle-in-segment-core.js; this file only puts the two
 * circles, the chord, the joining line and (with Hint on) the proof lines on
 * an SVG board. A is the one draggable handle; the chord follows it.
 */

(function () {
  const Core = IncircleInSegmentCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: the proof guides, then the figure, points, names
   * and the draggable handle. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const bigCircle = board.circle(Core.O, Core.R, "big-circle", shapes);
  const chord = board.segment(Core.M, Core.M, "chord", shapes);
  const smallCircle = board.circle(Core.O, 1, "incircle", shapes);
  const joiningLine = board.line(Core.M, Core.M, "joining-line", shapes);

  const guideLines = [
    board.line(Core.O, Core.M, "guide", guides),
    board.line(Core.O, Core.M, "guide guide-centre", guides),
    board.line(Core.O, Core.M, "guide guide-radius", guides),
    board.line(Core.M, Core.M, "guide guide-proof", guides),
  ];

  const dotKeys = ["B", "M", "S", "T", "O", "Op"];
  const dotStyle = {
    B: "dot dot-touch", M: "dot dot-m", S: "dot dot-muted",
    T: "dot dot-muted", O: "dot dot-muted", Op: "dot dot-touch",
  };
  const dotByKey = {};
  for (const key of dotKeys) dotByKey[key] = board.point(Core.M, dotStyle[key], 3.5, dots);

  const labelOffsets = {
    A: [8, -9], B: [7, -7], M: [-6, 19], S: [-17, -7],
    T: [7, -7], O: [-17, 18], Op: [7, 15],
  };
  const labels = {};
  for (const key of Object.keys(labelOffsets)) {
    labels[key] = board.label(Core.M, key === "Op" ? "O'" : key,
      "point-label", labelOffsets[key][0], labelOffsets[key][1], names);
  }

  const aHandle = board.handle("A", state.A, {
    label: "Point A, where the small circle touches the chord. Drag it, or focus it and use the arrow keys.",
    r: 8, step: 3, shift: 12, layer: top,
    clamp: (q) => Core.project(q),
    describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p) => {
      state = Core.move(state, p);
      render();
    },
  });

  /** Only the three classes below tell the record that a play has ended. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      say(Core.describe(state));
      if (window.Track) window.Track.state(state);
      return;
    }

    bigCircle.set(g.O, g.R);
    chord.set(g.S, g.T);
    smallCircle.set(g.Op, g.rho);
    joiningLine.set(g.M, g.B);

    guideLines[0].set(g.O, g.M);
    guideLines[1].set(g.Op, g.A);
    guideLines[2].set(g.O, g.B);
    guideLines[3].set(g.N, g.B);
    for (const line of guideLines) line.show(state.hint);

    for (const key of dotKeys) dotByKey[key].set(g[key]);
    for (const key of Object.keys(labels)) labels[key].set(g[key]);
    aHandle.set(state.A);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, M: g.M, O: g.O, Op: g.Op, N: g.N, S: g.S, T: g.T,
        R: g.R, radius: g.rho, scale: g.scale, arcMid: g.arcMid,
        options: { hint: state.hint },
      });
    }
  }

  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    hintBox.checked = state.hint;
    render();
  });

  board.onTheme(render);
  render();
})();
