"use strict";

/*
 * The page for Circle Centers On Radical Axes: drawing and input only. The
 * geometry is in circle-centers-on-radical-axes-core.js. The board holds three
 * circles, each with a draggable centre dot and a draggable rim dot. It draws
 * the three pairwise radical axes, their common point O, and a ring on any
 * centre that lies on the axis of the other two circles. Every dot is a
 * focusable Geom handle, so a player can drag it or nudge it with the arrow
 * keys; shapes are updated in place so focus survives a redraw.
 */

(function () {
  const Core = CircleCentersOnRadicalAxesCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const board = Geom.board(document.getElementById("board"));

  const hintLayer = board.layer("hint");
  const circleLayer = board.layer("circles");
  const axisLayer = board.layer("axes");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const NAMES = ["P", "Q", "R"];
  const AXES = ["PQ", "QR", "RP"];

  let state = Core.start({});
  let previous = state.center;
  let shown = Core.compute(state, previous);
  let showNames = true;
  let showHint = false;

  const rings = NAMES.map((name) =>
    board.circle({ x: 0, y: 0 }, 1, "ring ring-" + name, circleLayer));
  const axes = AXES.map((key) =>
    board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "axis axis-" + key, axisLayer));
  const hint = board.polygon([], "hint", hintLayer);
  const centerDot = board.point({ x: 0, y: 0 }, "radical-center", 4, markLayer);
  const onDots = NAMES.map(() => board.point({ x: 0, y: 0 }, "on-dot", 8, markLayer));
  const labels = NAMES.concat(["O"]).map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", 9, -9, labelLayer));

  /**
   * Shows a line under the board. `kind` is "win", "lose", "done" or nothing;
   * those three classes are how the player's record learns that a play has
   * ended, so a picture with no end never adds one.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /**
   * The applet's centre point carries its rim with it; a rim point changes
   * only that circle's radius. Both stay inside the board.
   */
  function makeHandle(name, index, isCentre) {
    return board.handle(name, isCentre ? state.circles[index].center : state.circles[index].rim, {
      r: 7, step: 2, shift: 10, layer: handleLayer,
      label: (isCentre ? "Centre" : "Rim") + " of circle " + NAMES[index] +
        ". Drag it, or focus it and use the arrow keys to move it",
      describe: (point) => "at " + Math.round(point.x) + ", " + Math.round(point.y),
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

  const centreHandles = NAMES.map((_, i) => makeHandle(NAMES[i], i, true));
  const rimHandles = NAMES.map((_, i) => makeHandle(NAMES[i] + "p", i, false));

  function render() {
    // Compute exactly as the applet does: the guard sees the O left by the
    // previous draw, and a skipped frame keeps the last drawn picture.
    const next = Core.compute(state, previous);
    shown = next;
    if (!next.skipped) previous = next.center;

    for (let i = 0; i < 3; i++) {
      rings[i].set(state.circles[i].center, Core.radius(state.circles[i]));
      centreHandles[i].set(state.circles[i].center);
      rimHandles[i].set(state.circles[i].rim);
      onDots[i].set(state.circles[i].center);
      onDots[i].show(!!shown.on[NAMES[i]]);
      labels[i].set(state.circles[i].center);
      labels[i].show(showNames);
    }

    for (let i = 0; i < axes.length; i++) {
      const line = shown.axes && shown.axes[AXES[i]];
      const ok = !!line && Number.isFinite(line.p.x) && Number.isFinite(line.p.y) &&
        Number.isFinite(line.r.x) && Number.isFinite(line.r.y);
      axes[i].show(ok);
      if (ok) axes[i].set(line.p, line.r);
    }

    const finite = Number.isFinite(shown.center.x) && Number.isFinite(shown.center.y);
    centerDot.show(finite);
    if (finite) centerDot.set(shown.center);
    labels[3].set(shown.center);
    labels[3].show(showNames && finite);

    hint.show(showHint);
    if (showHint) hint.set(state.circles.map((c) => c.center));

    const marked = NAMES.filter((name) => shown.on[name]);
    if (marked.length === 3) {
      say("P, Q and R all lie on their axes — every centre is lit. Move one dot to see the pattern change.");
    } else if (marked.length) {
      say(marked.join(" and ") + " " + (marked.length === 1 ? "lies" : "lie") +
        " on " + (marked.length === 1 ? "its" : "their") + " axis. Can you get all three?");
    } else {
      say("The three lines are the radical axes. They meet at O. Drag a dot to move or resize a circle.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state, shown));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    previous = state.center;
    shown = Core.compute(state, previous);
    previous = shown.center;
    render();
  });

  namesBtn.addEventListener("click", () => {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    render();
  });

  hintBtn.addEventListener("click", () => {
    showHint = !showHint;
    hintBtn.setAttribute("aria-pressed", String(showHint));
    render();
  });

  board.onTheme(() => render());
  render();
})();
