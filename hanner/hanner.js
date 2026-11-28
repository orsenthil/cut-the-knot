"use strict";

/*
 * Hanner — drawing and input only; all the dissection geometry is in
 * hanner-core.js. The board shows the right triangle ABC, its three squares,
 * five coloured pieces in the squares on the legs and the very same five
 * pieces slid into the square on the hypotenuse. A, B and C are focusable
 * draggable handles. C glides on the circumcircle after you grab it; the
 * triangle polygon or the Free C button releases it, exactly as the applet's
 * Fix(0) did. There is nothing to win or lose.
 */

(function () {
  const Core = HannerCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");
  const freeBtn = document.getElementById("freeBtn");

  let state = Core.start({});

  // Painting order: squares and guide lines below the pieces; the triangle
  // and its names above them; handles last, so keyboard focus survives a
  // redraw.
  const squaresLayer = board.layer("squares");
  const hintsLayer = board.layer("hints");
  const piecesLayer = board.layer("pieces");
  const triangleLayer = board.layer("triangle");
  const namesLayer = board.layer("names");
  const handlesLayer = board.layer("handles");

  const squareOnHypotenuse = board.polygon([{ x: 0, y: 0 }], "square-outline", squaresLayer);
  const squareOnAC = board.polygon([{ x: 0, y: 0 }], "square-outline", squaresLayer);
  const squareOnBC = board.polygon([{ x: 0, y: 0 }], "square-outline", squaresLayer);
  const hintLine = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "hint-line", hintsLayer);
  const glideCircle = board.circle({ x: 0, y: 0 }, 1, "glide-circle", hintsLayer);
  const triangle = board.polygon([{ x: 0, y: 0 }], "triangle", triangleLayer);

  const original = [], slid = [];
  for (let i = 0; i < 5; i++) {
    original.push(board.polygon([{ x: 0, y: 0 }], "piece piece-" + i, piecesLayer));
    slid.push(board.polygon([{ x: 0, y: 0 }], "piece ghost piece-" + i, piecesLayer));
  }

  const labels = {};
  for (const name of Core.NAMES) labels[name] = board.label({ x: 0, y: 0 }, name, "point-label", -20, -12, namesLayer);

  /** `#status` is how the player's record sees that the picture was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);

    squareOnHypotenuse.set(g.squares.hypotenuse);
    squareOnAC.set(g.squares.onAC);
    squareOnBC.set(g.squares.onBC);
    triangle.set([g.A, g.B, g.C]);

    for (let i = 0; i < 5; i++) {
      const shown = g.poly.length === 5;
      original[i].set(shown ? g.poly[i] : [g.A, g.A, g.A]).show(shown);
      slid[i].set(shown ? g.trans[i] : [g.A, g.A, g.A]).show(shown);
    }

    hintLine.set(g.C, g.Mp).show(Boolean(state.options.hint && g.poly.length === 5));
    glideCircle.set(state.circle ? state.circle.c : g.Mp, state.circle ? state.circle.r : 1)
      .show(Boolean(state.options.hint && state.circle));

    for (const name of Core.NAMES) {
      labels[name].set(state[name]);
      uiHandles[name].set(state[name]);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // Board units for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, angleA: state.angleA,
        squares: g.squares, branch: g.branch, pieces: g.poly, slid: g.trans,
        options: Object.assign({}, state.options), circle: state.circle,
      });
    }
  }

  const uiHandles = {};
  for (const name of Core.NAMES) {
    uiHandles[name] = board.handle(name, state[name], {
      r: 10, step: 4, shift: 16, layer: handlesLayer,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      clamp: (p) => Core.clampPoint(p),
      onMove: (p, which) => {
        state = Core.move(state, which, p);
        render();
      },
    });
  }

  // The old canvas starts a circle glide the moment C is grabbed with the
  // mouse; arrow-key moves after Free C stay free, as they did there.
  uiHandles.C.node.addEventListener("pointerdown", () => {
    state = Core.beginDrag(state, "C");
  });

  function freeC() {
    state = Core.freeC(state);
    render();
  }

  // Clicking the triangle was the applet's way to release C; the button is
  // the same action for keyboard and touch players.
  triangle.node.addEventListener("click", freeC);
  freeBtn.addEventListener("click", freeC);

  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    hintBox.checked = state.options.hint;
    render();
  });

  board.onTheme(render);
  render();
})();
