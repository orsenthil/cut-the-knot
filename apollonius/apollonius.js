"use strict";

/*
 * The page for Apollonius: drawing and input only. The algebra is in
 * apollonius-core.js. The board holds three given circles, each with a
 * draggable centre dot and a draggable rim dot, plus up to eight solution
 * circles. Every dot is a focusable Geom handle, so a player can drag with a
 * pointer or nudge with the arrow keys; shapes are updated in place so focus
 * survives a redraw.
 */

(function () {
  const Core = ApolloniusCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");
  const board = Geom.board(document.getElementById("board"));

  const givenLayer = board.layer("given");
  const solutionLayer = board.layer("solutions");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});

  const givenShapes = [0, 1, 2].map((i) =>
    board.circle(state.circles[i].center, 1, "given", givenLayer));
  const solutionShapes = Core.SIGN_TRIPLES.map(() =>
    board.circle({ x: 0, y: 0 }, 1, "solution", solutionLayer));

  /**
   * The shared status line. "win", "lose" and "done" are how the player's
   * record learns a play has ended; this is a picture with nothing to win, so
   * the text is only a report and no class is added.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The centre carries its rim with it; a rim dot changes the radius. */
  function makeHandle(name, index, isCentre) {
    return board.handle(name, isCentre ? state.circles[index].center : state.circles[index].rim, {
      r: 7, step: 2, shift: 10, layer: handlesLayer,
      label: (isCentre ? "Centre" : "Rim") + " of circle " + (index + 1) +
        ". Drag it, or focus it and use the arrow keys to move it.",
      clamp: (q) => ({
        x: Geom.clamp(q.x, 4, state.width - 4),
        y: Geom.clamp(q.y, 4, state.height - 4),
      }),
      onMove: (point) => {
        state = Core.movePoint(state, name, point);
        render();
      },
    });
  }

  const centreHandles = [0, 1, 2].map((i) => makeHandle("C" + (i + 1), i, true));
  const rimHandles = [0, 1, 2].map((i) => makeHandle("R" + (i + 1), i, false));

  function render() {
    const found = Core.solutions(state);
    for (let i = 0; i < 3; i++) {
      givenShapes[i].set(state.circles[i].center, Core.radius(state.circles[i]));
      centreHandles[i].set(state.circles[i].center);
      rimHandles[i].set(state.circles[i].rim);
    }
    for (let i = 0; i < solutionShapes.length; i++) {
      const c = found[i];
      solutionShapes[i].show(!!c);
      if (!c) continue;
      solutionShapes[i].set({ x: c.x, y: c.y }, c.radius);
      solutionShapes[i].node.setAttribute("class", "solution sol-" + c.color);
    }

    say("Three given circles, " + found.length + " tangent circles drawn. " +
      "Drag a centre or rim dot, or focus a dot and press the arrow keys.");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    say("");
    render();
  });

  board.onTheme(() => render());
  render();
})();
