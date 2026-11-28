"use strict";

/*
 * The page for Hinged Pythagoras 3: drawing and input only. The dissection
 * and its arithmetic live in hinged-pythagoras-3-core.js. The left half of the
 * board is the staircase of a b-square beside an a-square with two triangles
 * marked inside it. The right half repeats it, but its two triangles swing on
 * the orange hinges as the slider turns; at 90° the fixed cut lines and the
 * free triangle edges make a tilted square of side c.
 */

(function () {
  const Core = HingedPythagoras3Core;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const angleEl = document.getElementById("turnRange");
  const angleOut = document.getElementById("turnOut");
  const turnBtn = document.getElementById("turnBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const leftLayer = board.layer("left");
  const rightLayer = board.layer("right");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

  const leftStair = board.polygon([], "stair", leftLayer);
  const leftTriangles = [0, 1].map(() => board.polygon([], "piece piece-left", leftLayer));
  const dashed = board.segment(Core.pt(0, 0), Core.pt(0, 0), "guide", leftLayer);

  const spans = [0, 1, 2, 3, 4].map(() => board.segment(Core.pt(0, 0), Core.pt(0, 0), "cut", rightLayer));
  const rightTriangles = [0, 1].map(() => board.polygon([], "piece piece-right", rightLayer));
  const cSquare = board.polygon([], "csquare", marksLayer);
  const hingeLow = board.point(Core.pt(0, 0), "hinge", 6, marksLayer);
  const hingeHigh = board.point(Core.pt(0, 0), "hinge", 6, marksLayer);
  const dragRing = board.circle(Core.pt(0, 0), 12, "drag-ring", marksLayer);
  const leftLabel = board.label(Core.pt(0, 0), "a² + b²", "area-label", 0, 6, labelsLayer);
  const rightLabel = board.label(Core.pt(0, 0), "c²", "area-label", 0, 6, labelsLayer);

  const centroid = (points) => Core.pt(
    points.reduce((sum, p) => sum + p.x, 0) / points.length,
    points.reduce((sum, p) => sum + p.y, 0) / points.length,
  );

  /**
   * Shows a line under the board. This is an illustration with no win or
   * loss, so none of the record's win/lose/done classes is used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const p = Core.pieces(state);
    const id = Core.identity(state);
    const g = p.g;

    leftStair.set(g.L);
    p.leftTriangles.forEach((tri, i) => leftTriangles[i].set(tri));
    dashed.set(p.dashed[0], p.dashed[1]);

    p.spans.forEach(([a, b], i) => spans[i].set(a, b));
    p.rightTriangles.forEach((tri, i) => rightTriangles[i].set(tri));
    hingeLow.set(p.hingeLow);
    hingeHigh.set(p.hingeHigh);
    dragRing.set(p.M);
    mHandle.set(p.M);

    cSquare.set(p.cSquare).show(Core.formed(state));
    leftLabel.set(Core.pt(g.L[0].x + g.b / 2, g.L[0].y - g.b / 2), "a² + b²", 0, 6);
    rightLabel.set(centroid(p.cSquare), "c²", 0, 6);
    rightLabel.show(Core.formed(state));

    angleEl.value = String(state.angle);
    angleOut.textContent = state.angle + "°";
    readoutEl.textContent =
      `a = ${id.a}, b = ${id.b}  ·  a² + b² = ${id.a2} + ${id.b2} = ${id.c2} = c²`;

    if (Core.formed(state)) {
      say("A quarter turn: the two triangles meet at the top, and the outline is a tilted square of side c. Its area is a² + b².");
    } else if (state.angle === 0) {
      say("Two squares sit side by side. Drag M to change their sizes, then turn the two hinged triangles.");
    } else {
      say(`Turned ${state.angle}°. The triangles keep their shape; only the space around them changes.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const mHandle = board.handle("M", Core.layout(state).M, {
    r: 15, step: 5, shift: 3, cls: "geom-handle m-handle",
    label: "Hinge M. Drag it along the bottom edge of the left squares, or focus it and press the left and right arrow keys, to change the two triangle sizes.",
    describe: () => {
      const id = Core.identity(state);
      return `a ${id.a}, b ${id.b}`;
    },
    clamp: (q) => {
      const g = Core.layout(state);
      return { x: Core.clamp(q.x, g.L[0].x, g.L[1].x), y: g.L[0].y };
    },
    layer: handlesLayer,
    onMove: (q) => {
      state = Core.setHinge(state, q.x);
      render();
    },
  });

  angleEl.addEventListener("input", () => {
    state = Core.setAngle(state, Number(angleEl.value));
    render();
  });
  turnBtn.addEventListener("click", () => {
    state = Core.setAngle(state, Core.LIMITS.rightAngle);
    render();
    turnBtn.focus();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
    resetBtn.focus();
  });

  // Class-styled shapes need no redraw on a theme flip, but keep the hook.
  board.onTheme(render);

  render();
})();
