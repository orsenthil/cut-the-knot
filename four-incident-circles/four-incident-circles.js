"use strict";

/*
 * Four Incident Circles — the drawing and input, with all the geometry in
 * four-incident-circles-core.js.  The four red-centred circles all pass
 * through the common point; the straight lines are the applet's four common
 * tangents and the second circle runs through their intersections.  Dragging
 * any centre (pointer, touch or arrow keys) rescales the other three so the
 * invariant is kept, exactly as the applet's UpgradePoints does.
 */

(function () {
  const Core = FourIncidentCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const namesBox = document.getElementById("names");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({ hint: hintBox.checked, names: namesBox.checked });

  /* Back to front: the hint guides, the four equal circles, the tangents,
   * the circle through the B corners, names, then the handles that keep
   * keyboard focus when the picture is redrawn. */
  const guides = board.layer("guides");
  const circlesLayer = board.layer("circles");
  const tangentLayer = board.layer("tangents");
  const outerLayer = board.layer("outer");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const commonDot = board.point(state.center, "common-point", 5, guides);
  const guideCircle = board.circle(state.center, state.radius, "guide-circle", guides);
  const chords = Core.START_ANGLES.map((a, i) =>
    board.segment(state.A[i], state.A[(i + 1) % 4], "chord", guides));
  const circles = Core.START_ANGLES.map((a, i) =>
    board.circle(state.A[i], state.radius, "incircle", circlesLayer));
  const tangents = Core.START_ANGLES.map((a) =>
    board.line(state.center, state.center, "tangent", tangentLayer));
  const outer = board.circle(state.center, state.radius, "outer-circle", outerLayer);
  const corners = Core.START_ANGLES.map((a) =>
    board.point(state.center, "corner", 4, marks));
  const cornerNames = Core.START_ANGLES.map((a, i) =>
    board.label(state.center, "B" + (i + 1), "point-label", 9, -9, labels));
  const centerNames = Core.START_ANGLES.map((a, i) =>
    board.label(state.A[i], "A" + (i + 1), "point-label", -18, -12, labels));

  const handleOptions = {
    r: 9, step: 5, shift: 15, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = Core.START_ANGLES.map((a, i) => board.handle(
    "A" + (i + 1), state.A[i], Object.assign({}, handleOptions, {
      label: "Centre A" + (i + 1) + ". Drag it, or focus it and use the arrow keys to move the four circles.",
      onMove: (p) => {
        state = Core.move(state, i, p);
        render();
      },
    })));

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    commonDot.set(state.center);
    guideCircle.set(state.center, state.radius);
    guideCircle.show(state.options.hint);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      chords[i].set(state.A[i], state.A[j]);
      chords[i].show(state.options.hint);
      circles[i].set(g.circles[i].c, g.circles[i].r);
      handles[i].set(state.A[i]);
      centerNames[i].set(state.A[i]);
      centerNames[i].show(state.options.names);
      if (g.tangents[i]) {
        tangents[i].set(g.tangents[i][0], g.tangents[i][1]);
        tangents[i].show(true);
      } else {
        tangents[i].show(false);
      }
    }

    outer.show(!g.degenerate && !!g.outer);
    if (!g.degenerate && g.outer) outer.set(g.outer.center, g.outer.radius);
    for (let i = 0; i < 4; i++) {
      const show = !g.degenerate && state.options.names;
      corners[i].show(show);
      cornerNames[i].show(show);
      if (show) {
        corners[i].set(g.vertices[i]);
        cornerNames[i].set(g.vertices[i]);
      }
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("hint", hintBox);
  toggle("names", namesBox);

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    hintBox.checked = state.options.hint;
    namesBox.checked = state.options.names;
    render();
  });

  // Colours come from CSS classes, but keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
