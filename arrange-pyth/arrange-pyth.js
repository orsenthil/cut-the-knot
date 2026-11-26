"use strict";

/*
 * The page for Arrange Pyth: drawing and input only; the cuts and their areas
 * are in arrange-pyth-core.js. The left half of the board is the left square,
 * cut into four yellow right triangles and the red square on the long side c.
 * The right half is the right square, cut into the same four triangles and the
 * red squares on the two shorter sides a and b. Dragging M along the bottom
 * edge of the left square changes a and b while keeping a + b fixed.
 */

(function () {
  const Core = ArrangePythCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const resetBtn = document.getElementById("resetBtn");
  const midBtn = document.getElementById("midBtn");

  const board = Geom.board(document.getElementById("board"));
  const fills = board.layer("fills");
  const frames = board.layer("frames");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start();

  const leftFills = [0, 1, 2, 3, 4].map((i) =>
    board.polygon([], "piece " + (i === 4 ? "red-piece" : "yellow-piece"), fills));
  const rightFills = [0, 1, 2, 3, 4, 5].map((i) =>
    board.polygon([], "piece " + (i >= 4 ? "red-piece" : "yellow-piece"), fills));
  const leftFrame = board.polygon([], "frame", frames);
  const rightFrame = board.polygon([], "frame", frames);
  const legA = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "leg-a", frames);
  const legB = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "leg-b", frames);
  const aLabel = board.label({ x: 0, y: 0 }, "a", "dim", 0, 0, labels);
  const bLabel = board.label({ x: 0, y: 0 }, "b", "dim", 0, 0, labels);
  const cLabel = board.label({ x: 0, y: 0 }, "c²", "area-label", 0, 0, labels);
  const a2Label = board.label({ x: 0, y: 0 }, "a²", "area-label", 0, 0, labels);
  const b2Label = board.label({ x: 0, y: 0 }, "b²", "area-label", 0, 0, labels);

  const mid = (p, q) => Core.pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const centroid = (points) => Core.pt(
    points.reduce((s, p) => s + p.x, 0) / points.length,
    points.reduce((s, p) => s + p.y, 0) / points.length,
  );

  /**
   * Shows a line under the game. A demo has nothing to win or lose, so no
   * kind (and no win/lose/done class) is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.layout(state.width, state.height);
    const p = Core.pieces(state);
    const m = Core.measures(state);

    leftFills.forEach((shape, i) => shape.set(p.left[i].points));
    rightFills.forEach((shape, i) => shape.set(p.right[i].points));
    leftFrame.set(g.L);
    rightFrame.set(g.R);
    legA.set(g.L[0], state.m);
    legB.set(state.m, g.L[1]);

    const aMid = mid(g.L[0], state.m), bMid = mid(state.m, g.L[1]);
    aLabel.set(aMid, "a", 0, 30);
    bLabel.set(bMid, "b", 0, 30);
    cLabel.set(centroid(p.left[4].points), "c²", 0, 6);
    a2Label.set(centroid(p.right[4].points), "a²", 0, 6);
    b2Label.set(centroid(p.right[5].points), "b²", 0, 6);

    mHandle.set(state.m);
    readoutEl.textContent = `${m.a}² + ${m.b}² = ${m.a2} + ${m.b2} = ${m.c2} = c²`;
    say(`a is ${m.a} and b is ${m.b}. The red square on the left has area ${m.c2}, ` +
      `the same as the two red squares on the right: ${m.a2} + ${m.b2}.`);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const mHandle = board.handle("M", state.m, {
    r: 14, step: 1, shift: 5, cls: "geom-handle m-handle",
    label: "Point M. Drag it along the bottom edge, or focus it and press the left and right arrow keys, to change a and b.",
    describe: () => `a ${state.a}, b ${state.b}`,
    clamp: (q) => {
      const g = Core.layout(state.width, state.height);
      return {
        x: Core.clamp(Math.round(q.x), g.L[0].x, g.L[1].x),
        y: g.L[0].y,
      };
    },
    layer: handles,
    onMove: (q) => {
      state = Core.withM(state, q.x, q.y);
      render();
    },
  });

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });
  midBtn.addEventListener("click", () => {
    state = Core.midpoint(state);
    render();
  });

  // Class-styled shapes need no redraw on a theme flip, but keep the hook.
  board.onTheme(render);

  render();
})();
