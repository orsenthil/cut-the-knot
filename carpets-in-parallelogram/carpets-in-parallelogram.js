"use strict";

/*
 * Carpets In Parallelogram — drawing and input only; all of the geometry is
 * in carpets-in-parallelogram-core.js. The board holds a parallelogram ABCD
 * with seven draggable points: the four corners and P on BC, Q on CD, R on
 * AD. The five lines AQ, BR, AP, PR and BQ cut out the red, blue, pink and
 * orange pieces. Every SVG object is created once and only updated on a
 * redraw, so a handle keeps keyboard focus while its neighbours move.
 */

(function () {
  const Core = CarpetsInParallelogramCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const lines = board.layer("lines");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  /* The four red pieces and the two versions of triangle A-B-W. */
  const redA = board.polygon([state.A, state.A, state.A], "red", fills);
  const redD = board.polygon([state.A, state.A, state.A], "red", fills);
  const redC = board.polygon([state.A, state.A, state.A], "red", fills);
  const redB = board.polygon([state.A, state.A, state.A], "red", fills);
  const redW = board.polygon([state.A, state.A, state.A], "red", fills);
  const orangeW = board.polygon([state.A, state.A, state.A], "orange", fills);
  const blue = board.polygon([state.A, state.A, state.A], "blue", fills);
  const pinkPenta = board.polygon([state.A, state.A, state.A], "pink", fills);
  const pinkR = board.polygon([state.A, state.A, state.A], "pink", fills);
  const pinkP = board.polygon([state.A, state.A, state.A], "pink", fills);

  /* The five cutting lines from the applet's Draw(), plus its outline. */
  const cuts = [
    board.segment(state.A, state.A, "cut", lines), // AQ
    board.segment(state.A, state.A, "cut", lines), // BR
    board.segment(state.A, state.A, "cut", lines), // BQ
    board.segment(state.A, state.A, "cut", lines), // PR
    board.segment(state.A, state.A, "cut", lines), // AP
  ];
  const outline = board.polygon([state.A, state.B, state.C, state.D], "outline", lines);

  const labelPos = {
    A: [-16, -9], B: [7, -9], C: [7, 15], D: [-16, 15],
    P: [8, -7], Q: [-16, -8], R: [-16, -8],
    S: [7, -7], T: [7, -7], U: [7, 15], V: [7, 15], W: [7, -7],
  };
  const labelsFor = {};
  for (const key of Object.keys(labelPos)) {
    labelsFor[key] = board.label(state.A, key, "point-label",
      labelPos[key][0], labelPos[key][1], labels);
  }

  const handleOptions = {
    step: 4, shift: 12, r: 8, layer: top,
    clamp: (p) => Core.clampToBoard(p),
  };
  const handles = {};
  const corners = ["A", "B", "C", "D"];
  const sidePoints = ["P", "Q", "R"];
  for (const key of corners) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Corner ${key}. Drag it sideways, or focus it and use the left and right arrow keys.`,
      onMove: (p, name) => { state = Core.movePoint(state, name, p); render(); },
    }));
  }
  const side = { P: "BC", Q: "CD", R: "AD" };
  for (const key of sidePoints) {
    handles[key] = board.handle(key, Core.at(state[key === "P" ? "B" : key === "Q" ? "C" : "A"],
      state[key === "P" ? "C" : key === "Q" ? "D" : "D"],
      state["coef" + key]), Object.assign({}, handleOptions, {
      label: `Point ${key} on side ${side[key]}. Drag it along the side, or focus it and use the arrow keys.`,
      onMove: (p, name) => { state = Core.movePoint(state, name, p); render(); },
    }));
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const key of corners.concat(sidePoints)) handles[key].set(g[key]);

    redA.set([g.A, g.S, g.R]);
    redD.set([g.R, g.T, g.Q, g.D]);
    redC.set([g.C, g.P, g.U, g.Q]);
    redB.set([g.B, g.P, g.V]);
    redW.set([g.A, g.B, g.W]).show(!state.showHint);
    orangeW.set([g.A, g.B, g.W]).show(state.showHint);
    blue.set([g.S, g.T, g.U, g.V, g.W]).show(!state.showHint);
    pinkPenta.set([g.S, g.T, g.U, g.V, g.W]).show(state.showHint);
    pinkR.set([g.R, g.S, g.T]).show(state.showHint);
    pinkP.set([g.P, g.U, g.V]).show(state.showHint);
    const draw = !g.noDraw;
    for (const f of [redA, redD, redC, redB]) f.show(draw);
    redW.show(draw && !state.showHint);
    orangeW.show(draw && state.showHint);
    blue.show(draw && !state.showHint);
    pinkPenta.show(draw && state.showHint);
    pinkR.show(draw && state.showHint);
    pinkP.show(draw && state.showHint);

    cuts[0].set(g.A, g.Q).show(draw);
    cuts[1].set(g.B, g.R).show(draw);
    cuts[2].set(g.B, g.Q).show(draw);
    cuts[3].set(g.P, g.R).show(draw);
    cuts[4].set(g.A, g.P).show(draw);
    outline.set([g.A, g.B, g.C, g.D]);

    for (const key of corners) labelsFor[key].set(g[key]).show(state.showNames);
    for (const key of sidePoints.concat(["S", "T", "U", "V", "W"])) {
      labelsFor[key].set(g[key]).show(state.showNames && draw);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, P: g.P, Q: g.Q, R: g.R,
        S: g.finite ? g.S : null, T: g.finite ? g.T : null,
        U: g.finite ? g.U : null, V: g.finite ? g.V : null,
        W: g.finite ? g.W : null,
        coefP: state.coefP, coefQ: state.coefQ, coefR: state.coefR,
        red: g.red, blue: g.blue, difference: g.difference, half: g.half,
        showHint: state.showHint, noDraw: g.noDraw,
      });
    }
  }

  namesBox.checked = state.showNames;
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "showNames", namesBox.checked);
    render();
  });
  hintBox.checked = state.showHint;
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "showHint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
