"use strict";

/*
 * The page for Eyeball 2: drawing and input only. The geometry is in
 * eyeball-2-core.js. Four focusable handles control the two centres and the
 * two points on their rims; the tangents and the two equal circles are redrawn
 * in place, so a handle keeps its keyboard focus. Every number shown comes
 * from the core, never from the pointer's screen pixels.
 */

(function () {
  const Core = Eyeball2Core;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const circlesLayer = board.layer("circles");
  const tangentsLayer = board.layer("tangents");
  const incirclesLayer = board.layer("incircles");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});
  let explored = false;

  const centreLine = board.segment(state.A, state.B, "centre-line", guides);
  const mainCircles = [
    board.circle(state.A, 1, "main-circle", circlesLayer),
    board.circle(state.B, 1, "main-circle", circlesLayer),
  ];
  const tangentShapes = [0, 1, 2, 3].map(() =>
    board.segment(state.A, state.B, "tangent", tangentsLayer));
  const innerCircles = [
    board.circle(state.A, 1, "inner-circle", incirclesLayer),
    board.circle(state.B, 1, "inner-circle", incirclesLayer),
  ];
  const labels = ["A", "B", "P", "Q"].map((text) =>
    board.label(state.A, text, "point-label", -8, -10, labelsLayer));

  /**
   * The shared status line. "done" tells the player's record that this
   * illustration has been explored; it is not a win or a loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function moveHandle(name, point) {
    state = Core.setPoint(state, name, point);
    explored = true;
    render();
  }

  const handleOptions = (name, kind) => ({
    r: 16, step: 5, shift: 20, layer: handlesLayer,
    cls: "geom-handle " + kind,
    label: name + ". Drag it, or focus it and use the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, 4, state.width - 4),
      y: Geom.clamp(q.y, 4, state.height - 4),
    }),
    onMove: (point) => moveHandle(name, point),
  });
  const handles = [
    board.handle("A", state.A, handleOptions("A", "centre-handle")),
    board.handle("B", state.B, handleOptions("B", "centre-handle")),
    board.handle("boundaryA", state.boundaryA, handleOptions("boundaryA", "radius-handle")),
    board.handle("boundaryB", state.boundaryB, handleOptions("boundaryB", "radius-handle")),
  ];
  const ids = ["handle-A", "handle-B", "handle-boundaryA", "handle-boundaryB"];
  handles.forEach((h, i) => { h.node.id = ids[i]; });

  function render() {
    const g = Core.measure(state);
    centreLine.set(g.A, g.B);
    mainCircles[0].set(g.A, g.ra);
    mainCircles[1].set(g.B, g.rb);

    const pairs = [
      { vertex: g.P, points: g.tangents.fromP },
      { vertex: g.Q, points: g.tangents.fromQ },
    ];
    let i = 0;
    for (const pair of pairs) {
      for (let k = 0; k < 2; k++, i++) {
        if (pair.points.length === 2) tangentShapes[i].set(pair.vertex, pair.points[k]).show(true);
        else tangentShapes[i].show(false);
      }
    }
    for (let k = 0; k < 2; k++) innerCircles[k].set(g.incircles[k].centre, g.r).show(g.possible);

    const spots = [g.A, g.B, g.P, g.Q];
    for (let k = 0; k < labels.length; k++) labels[k].set(spots[k]);
    handles[0].set(g.A);
    handles[1].set(g.B);
    handles[2].set(state.boundaryA);
    handles[3].set(state.boundaryB);

    if (!g.possible) {
      say("One circle is too big here: no tangents can be drawn from P and Q.", explored ? "done" : null);
    } else {
      say("Both green circles have radius " + g.r.toFixed(1) + ". They are always equal.", explored ? "done" : null);
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    explored = false;
    render();
  });

  board.onTheme(() => render());
  render();
})();
