"use strict";

/*
 * Four Squares From Temple — the drawing and the input. All the geometry is
 * in four-squares-from-temple-core.js. The board shows the four hinged
 * squares (AESX, CHIY, BEKH and KINS), the line A-B-C, and, with the hint on,
 * Bottema's points U and V and the circle about K. A, B and C are focusable
 * draggable handles; moving A or C ties the other outer handle's height to
 * it, exactly as the applet's UpgradePoints does. There is nothing to win.
 */

(function () {
  const Core = FourSquaresFromTempleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  // Painting order: guides below the fills, squares above them, names and
  // finally the handles so keyboard focus is never lost on a redraw.
  const guidesLayer = board.layer("guides");
  const fillsLayer = board.layer("fills");
  const squaresLayer = board.layer("squares");
  const dotsLayer = board.layer("dots");
  const namesLayer = board.layer("names");
  const handlesLayer = board.layer("handles");

  const baseline = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "baseline", guidesLayer);
  const auxCircle = board.circle({ x: 0, y: 0 }, 1, "aux-circle", guidesLayer);
  const hintPairs = [
    ["U", "A"], ["U", "B"], ["U", "K"], ["U", "S"],
    ["V", "B"], ["V", "C"], ["V", "K"], ["V", "I"],
    ["K", "B"], ["S", "I"],
  ];
  const hintLines = hintPairs.map(() =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", guidesLayer));
  const hintDots = ["U", "V"].map(() =>
    board.point({ x: 0, y: 0 }, "hint-dot", 5, guidesLayer));

  const smallFill = board.polygon([{ x: 0, y: 0 }], "fill-small", fillsLayer);
  const bigFill = board.polygon([{ x: 0, y: 0 }], "fill-big", fillsLayer);

  const squareOuterA = board.polygon([{ x: 0, y: 0 }], "square square-outer", squaresLayer);
  const squareOuterC = board.polygon([{ x: 0, y: 0 }], "square square-outer", squaresLayer);
  const squareSmall = board.polygon([{ x: 0, y: 0 }], "square square-small", squaresLayer);
  const squareBig = board.polygon([{ x: 0, y: 0 }], "square square-big", squaresLayer);

  const vertexDots = {};
  for (const name of ["X", "S", "E", "K", "H", "I", "Y", "N"]) {
    vertexDots[name] = board.point({ x: 0, y: 0 }, "vertex-dot", 4, dotsLayer);
  }

  const labels = {};
  for (const name of ["A", "B", "C", "X", "S", "E", "K", "H", "I", "Y", "N", "U", "V"]) {
    labels[name] = board.label({ x: 0, y: 0 }, name, "point-label", 9, -8, namesLayer);
  }

  /** `#status` is how the player's record sees the picture was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const opts = state.options;

    for (const name of ["A", "B", "C"]) uiHandles[name].set(state[name]);

    baseline.set(g.A, g.B);
    auxCircle.set(g.circle.c, g.circle.r).show(Boolean(opts.hint && g.onLine));

    const byName = {
      U: g.U, V: g.V, K: g.K, B: g.B, S: g.S, A: g.A, C: g.C, I: g.I,
    };
    hintLines.forEach((line, i) => {
      const [p, q] = hintPairs[i];
      line.set(byName[p], byName[q]).show(Boolean(opts.hint));
    });
    hintDots[0].set(g.U).show(Boolean(opts.hint));
    hintDots[1].set(g.V).show(Boolean(opts.hint));

    smallFill.set([g.B, g.E, g.K, g.H]).show(g.onLine);
    bigFill.set([g.K, g.I, g.N, g.S]).show(g.onLine);

    squareOuterA.set([g.X, g.A, g.S, g.E]);
    squareOuterC.set([g.C, g.Y, g.I, g.H]);
    squareSmall.set([g.B, g.E, g.K, g.H]);
    squareBig.set([g.K, g.I, g.N, g.S]);

    for (const name of Object.keys(vertexDots)) vertexDots[name].set(g[name]);

    const shown = { A: g.A, B: g.B, C: g.C, X: g.X, S: g.S, E: g.E, K: g.K,
      H: g.H, I: g.I, Y: g.Y, N: g.N, U: g.U, V: g.V };
    for (const name of Object.keys(labels)) {
      const visible = opts.names && (name !== "U" && name !== "V" || opts.hint);
      if (["A", "B", "C"].includes(name)) labels[name].show(true);
      else labels[name].show(visible);
      labels[name].set(shown[name]);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // Board units for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, U: g.U, V: g.V, K: g.K, E: g.E, H: g.H,
        X: g.X, S: g.S, I: g.I, Y: g.Y, N: g.N, circle: g.circle,
        onLine: g.onLine, options: opts,
      });
    }
  }

  const uiHandles = {};
  for (const name of ["A", "B", "C"]) {
    uiHandles[name] = board.handle(name, state[name], {
      r: 10, step: 4, shift: 20, layer: handlesLayer,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      clamp: (p) => Core.clampPoint(p),
      onMove: (p) => { state = Core.move(state, name, p); render(); },
    });
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("hint", hintBox);

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    hintBox.checked = state.options.hint;
    render();
  });

  board.onTheme(render);
  render();
})();
