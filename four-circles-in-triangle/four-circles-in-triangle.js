"use strict";

/*
 * The page for Four Circles In Triangle: drawing and input only. The geometry
 * is in four-circles-in-triangle-core.js. Three focusable handles A, B and C
 * set the triangle; every circle and joining line is created once and then
 * updated in place, so a handle keeps its keyboard focus while it moves.
 */

(function () {
  const Core = FourCirclesInTriangleCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const linesChk = document.getElementById("linesChk");
  const pointsChk = document.getElementById("pointsChk");
  const namesChk = document.getElementById("namesChk");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const edgesLayer = board.layer("edges");
  const circlesLayer = board.layer("circles");
  const linesLayer = board.layer("lines");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});
  const first = Core.diagram(state);

  const edges = [
    board.segment(state.vertices[0], state.vertices[1], "triangle-edge", edgesLayer),
    board.segment(state.vertices[1], state.vertices[2], "triangle-edge", edgesLayer),
    board.segment(state.vertices[2], state.vertices[0], "triangle-edge", edgesLayer),
  ];
  const incircle = board.circle(first.incircle.center, first.incircle.radius, "incircle", circlesLayer);
  const cornerCircles = first.circles.map((c) =>
    board.circle(c.center, c.radius, "corner-circle", circlesLayer));
  const joins = [0, 1, 2].map(() => board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "join", linesLayer));
  const feet = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "foot-dot", 3.5, dotsLayer));
  const touches = [0, 1, 2].map(() => board.point({ x: 0, y: 0 }, "touch-dot", 4, dotsLayer));
  const meeting = board.point(first.meeting, "meeting-dot", 5.5, dotsLayer);
  const labelOffsets = [{ x: -5, y: -11 }, { x: -13, y: 15 }, { x: 7, y: 15 }];
  const labels = ["A", "B", "C"].map((name, i) =>
    board.label(state.vertices[i], name, "point-label", labelOffsets[i].x, labelOffsets[i].y, labelsLayer));

  const names = ["A", "B", "C"];
  const handles = names.map((name, i) => board.handle(name, state.vertices[i], {
    r: 9, step: 4, shift: 20, layer: handlesLayer,
    label: "Vertex " + name + ". Drag it, or focus it and use the arrow keys to reshape the triangle.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.MARGIN, state.width - Core.MARGIN),
      y: Geom.clamp(q.y, Core.MARGIN, state.height - Core.MARGIN),
    }),
    onMove: (point) => {
      state = Core.setVertex(state, i, point);
      render();
    },
  }));

  /**
   * The status line under the board. "win", "lose" and "done" are how the
   * player's record learns a play has ended; this is a picture with no win or
   * loss, so no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.diagram(state);
    const draw = d.visible;
    const showLines = draw && state.showLines;
    const showPoints = draw && state.showPoints;

    for (let i = 0; i < 3; i++) {
      edges[i].set(state.vertices[i], state.vertices[(i + 1) % 3]);
      labels[i].set(state.vertices[i], names[i], labelOffsets[i].x, labelOffsets[i].y);
      labels[i].show(draw && state.showNames);
      joins[i].show(showLines);
      feet[i].show(showPoints);
      touches[i].show(showPoints);
      handles[i].set(state.vertices[i]);
    }
    incircle.set(d.incircle.center, d.incircle.radius).show(draw);
    for (let i = 0; i < 3; i++) {
      cornerCircles[i].set(d.circles[i].center, d.circles[i].radius).show(draw);
      if (showLines) joins[i].set(d.lines[i].a, d.lines[i].b);
      if (showPoints) {
        feet[i].set(d.feet[i]);
        touches[i].set(d.touch[i]);
      }
    }
    meeting.set(d.meeting).show(draw);

    if (!draw) {
      say(d.reason + " Move A, B or C to try again.");
    } else {
      say("The three lines meet at (" + Math.round(d.meeting.x) + ", " +
        Math.round(d.meeting.y) + ").");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  linesChk.addEventListener("change", () => {
    state = { ...state, showLines: linesChk.checked };
    render();
  });
  pointsChk.addEventListener("change", () => {
    state = { ...state, showPoints: pointsChk.checked };
    render();
  });
  namesChk.addEventListener("change", () => {
    state = { ...state, showNames: namesChk.checked };
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
