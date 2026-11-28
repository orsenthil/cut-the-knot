"use strict";

/*
 * Minkowski Addition — drawing and input only.  The geometry lives in
 * minkowski-addition-core.js: four draggable points A, B, O and O', the two
 * sums S = A + B - O and S' = A + B - O', and the parallelogram OS'SO' that
 * links them.  The twelve lines are created once and only updated on a
 * redraw, so a handle keeps keyboard focus.  The three checkboxes isolate the
 * applet's red, blue and pink sets of lines.
 */

(function () {
  const Core = MinkowskiAdditionCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    showFirst: document.getElementById("showFirst"),
    showSecond: document.getElementById("showSecond"),
    showShift: document.getElementById("showShift"),
  };
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front.  The glow under the two matching segments makes
   * the shift visible without a fixed colour that would fail in dark mode. */
  const glowLayer = board.layer("glow");
  const firstLayer = board.layer("first");
  const secondLayer = board.layer("second");
  const shiftLayer = board.layer("shift");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const glow = [
    board.segment(state.O, state.Op, "shift-glow", glowLayer),
    board.segment(state.S || state.A, state.A, "shift-glow", glowLayer),
  ];
  const firstLines = [
    board.segment(state.O, state.A, "sum-a", firstLayer),
    board.segment(state.O, state.B, "sum-a", firstLayer),
    board.segment(state.A, state.A, "sum-a", firstLayer),
    board.segment(state.B, state.A, "sum-a", firstLayer),
  ];
  const secondLines = [
    board.segment(state.Op, state.A, "sum-b", secondLayer),
    board.segment(state.Op, state.B, "sum-b", secondLayer),
    board.segment(state.A, state.A, "sum-b", secondLayer),
    board.segment(state.B, state.A, "sum-b", secondLayer),
  ];
  const shiftLines = [
    board.segment(state.O, state.Op, "shift-side", shiftLayer),
    board.segment(state.A, state.A, "shift-side", shiftLayer),
    board.segment(state.A, state.A, "shift-side", shiftLayer),
    board.segment(state.O, state.A, "shift-side", shiftLayer),
  ];

  const sumDots = [
    board.point(state.A, "sum-dot", 5, dotLayer),
    board.point(state.A, "sum-dot-prime", 5, dotLayer),
  ];
  const midDot = board.point(state.A, "mid-dot", 4, dotLayer);

  const labelKeys = ["A", "B", "O", "Op", "S", "Sp", "M"];
  const labelText = { A: "A", B: "B", O: "O", Op: "O'", S: "S", Sp: "S'", M: "M" };
  const labelOffset = {
    A: [-18, -10], B: [9, -10], O: [-18, 20], Op: [10, -10],
    S: [9, -10], Sp: [-22, -10], M: [8, 18],
  };
  const labels = {};
  for (const key of labelKeys) {
    const off = labelOffset[key];
    labels[key] = board.label(state.A, labelText[key], "point-label", off[0], off[1], labelLayer);
  }

  const handleOpts = {
    step: 5, shift: 15, r: 9, layer: handleLayer,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of ["A", "B", "O", "Op"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOpts, {
      label: `Point ${labelText[key]}. Drag it, or focus it and use the arrow keys to move ${labelText[key]}.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "O", "Op"]) handles[key].set(state[key]);
    if (!g) {
      for (const s of glow.concat(firstLines, secondLines, shiftLines, sumDots, [midDot])) s.show(false);
      for (const key of labelKeys) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    for (let i = 0; i < firstLines.length; i++) {
      firstLines[i].set(g.red[i][0], g.red[i][1]).show(state.options.showFirst);
      secondLines[i].set(g.blue[i][0], g.blue[i][1]).show(state.options.showSecond);
      shiftLines[i].set(g.pink[i][0], g.pink[i][1]).show(state.options.showShift);
    }
    glow[0].set(g.O, g.Op).show(state.options.showShift);
    glow[1].set(g.S, g.Sp).show(state.options.showShift);

    sumDots[0].set(g.S).show(true);
    sumDots[1].set(g.Sp).show(true);
    midDot.set(g.M).show(state.options.showShift);

    for (const key of labelKeys) {
      const p = key === "M" ? g.M : g[key];
      labels[key].set(p).show(key === "S" || key === "Sp" || key === "M"
        ? state.options.showShift : true);
    }

    say(Core.describe(state), state.explored ? "done" : null);
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, O: g.O, Op: g.Op, S: g.S, Sp: g.Sp, M: g.M,
        shift: g.shift, sumShift: g.sumShift, options: state.options,
      });
    }
  }

  for (const name of Object.keys(boxes)) {
    boxes[name].checked = state.options[name];
    boxes[name].addEventListener("change", () => {
      state = Core.setOption(state, name, boxes[name].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const name of Object.keys(boxes)) boxes[name].checked = state.options[name];
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
