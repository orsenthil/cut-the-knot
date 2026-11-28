"use strict";

/*
 * The page for Hinged Pythagoras: drawing and input only. The dissection and
 * its arithmetic are in hinged-pythagoras-core.js. The left half of the board
 * is the square with a tilted square of area c² in the middle; the right half
 * has the same four triangles, two of them swinging on hinges as the rotation
 * slider turns. At 90° the spaces they leave are two squares of sides a and b.
 */

(function () {
  const Core = HingedPythagorasCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const angleEl = document.getElementById("angleRange");
  const angleOut = document.getElementById("angleOut");
  const ninetyBtn = document.getElementById("ninetyBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const frames = board.layer("frames");
  const piecesLayer = board.layer("pieces");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = Core.start();

  const leftFrame = board.polygon([], "frame", frames);
  const rightFrame = board.polygon([], "frame", frames);
  const leftPieces = [0, 1, 2, 3].map(() => board.polygon([], "piece piece-left", piecesLayer));
  const rightFixed = [0, 1].map(() => board.polygon([], "piece piece-fixed", piecesLayer));
  const rightTurned = [0, 1].map(() => board.polygon([], "piece piece-turned", piecesLayer));
  const guide = board.segment(Core.pt(0, 0), Core.pt(0, 0), "guide", marks);
  const hingeV = board.point(Core.pt(0, 0), "hinge-dot", 5, marks);
  const hingeF = board.point(Core.pt(0, 0), "hinge-dot", 5, marks);
  const dragRing = board.circle(Core.pt(0, 0), 11, "drag-ring", marks);
  const cLabel = board.label(Core.pt(0, 0), "c²", "area-label", 0, 6, labels);
  const b2Label = board.label(Core.pt(0, 0), "b²", "area-label", 0, 6, labels);
  const a2Label = board.label(Core.pt(0, 0), "a²", "area-label", 0, 6, labels);

  const centroid = (points) => Core.pt(
    points.reduce((sum, p) => sum + p.x, 0) / points.length,
    points.reduce((sum, p) => sum + p.y, 0) / points.length,
  );

  /**
   * Shows a line under the game. This is an illustration with no win or loss,
   * so no kind (and no win/lose/done class) is used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.layout(state);
    const p = Core.pieces(state);
    const id = Core.identity(state);
    const line = Core.guide(state);

    leftFrame.set(g.L);
    rightFrame.set(g.R);
    p.left.forEach((tri, i) => leftPieces[i].set(tri));
    p.fixed.forEach((tri, i) => rightFixed[i].set(tri));
    p.turned.forEach((tri, i) => rightTurned[i].set(tri));

    guide.show(!!line);
    if (line) guide.set(Core.pt(line.x1, line.y), Core.pt(line.x2, line.y));
    hingeV.set(p.V);
    hingeF.set(p.F);
    dragRing.set(p.M);
    mHandle.set(p.M);

    const cCentre = centroid(p.tilted);
    cLabel.set(cCentre, "c²", 0, 6);
    const squares = Core.legSquares(state);
    b2Label.set(centroid(squares[0]), "b²", 0, 6).show(Core.formed(state));
    a2Label.set(centroid(squares[1]), "a²", 0, 6).show(Core.formed(state));

    angleEl.value = String(state.angle);
    angleOut.textContent = state.angle + "°";
    readoutEl.textContent =
      `a = ${id.a}, b = ${id.b}  ·  a² + b² = ${id.a2} + ${id.b2} = ${id.c2} = c²`;

    if (Core.formed(state)) {
      say("At 90° the two hinged triangles swing clear: the open spaces are squares of sides b and a. Their areas add up to the tilted square on the left.");
    } else if (state.angle === 0) {
      say("Both squares are cut the same way. Drag M to change the triangles, then turn the two hinged pieces.");
    } else {
      say(`Turned ${state.angle}°. The two hinged pieces keep their shape; only the space between them changes.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const mHandle = board.handle("M", Core.layout(state).M, {
    r: 15, step: 5, shift: 3, cls: "geom-handle m-handle",
    label: "Hinge M. Drag it along the bottom edge of the left square, or focus it and press the left and right arrow keys, to change the two triangle legs.",
    describe: () => {
      const id = Core.identity(state);
      return `a ${id.a}, b ${id.b}`;
    },
    clamp: (p) => {
      const g = Core.layout(state);
      return { x: Core.clamp(p.x, g.L[0].x, g.L[1].x), y: g.L[0].y };
    },
    layer: handles,
    onMove: (p) => {
      state = Core.setHinge(state, p.x);
      render();
    },
  });

  angleEl.addEventListener("input", () => {
    state = Core.setAngle(state, Number(angleEl.value));
    render();
  });
  ninetyBtn.addEventListener("click", () => {
    state = Core.setAngle(state, 90);
    render();
    ninetyBtn.focus();
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
