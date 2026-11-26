"use strict";

/*
 * The page for Abul Wafa Pythagoras: drawing and input only. The dissection
 * lives in abul-wafa-pythagoras-core.js. The left half of the board shows the
 * two squares with the right triangle A-B-E drawn in the big one; once the
 * small square's corner is slid onto the big one's corner, the seven pieces
 * can be moved into the square on the triangle's third side on the right.
 * Dragging B changes a, dragging E changes b, dragging the corner of the
 * small square lines the two squares up.
 */

(function () {
  const Core = AbulWafaPythagorasCore;
  const statusEl = document.getElementById("status");
  const readoutEl = document.getElementById("readout");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");

  // Board units. A, the shared lower-left corner, sits at (OX, OY); the
  // assembled square's Dp corner is 360 right and 140 above it.
  const OX = 30, OY = 310;
  const AT = { x: 330, y: -130 };
  const DURATION = 3500; // 500ms per piece, as in the applet's run()
  const clamp = Core.clamp;
  const abs = (p) => ({ x: p.x + OX, y: p.y + OY });
  const shifted = (p, g) => ({ x: p.x + OX + g.x, y: p.y + OY + g.y });
  const fmt = (n) => n.toFixed(1);
  const mid = (p, q) => Core.pt((p.x + q.x) / 2, (p.y + q.y) / 2);
  const lerp = (p, q, t) => Core.pt(p.x + (q.x - p.x) * t, p.y + (q.y - p.y) * t);

  let state = Core.start();
  let anim = null; // { t0 } while the pieces are moving

  const board = Geom.board(document.getElementById("board"));
  const outlines = board.layer("outlines");
  const piecesLayer = board.layer("pieces");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const bigSquare = board.polygon([], "outline outline-big", outlines);
  const smallSquare = board.polygon([], "outline outline-small", outlines);
  const triangleFill = board.polygon([], "triangle-fill", marks);
  const triangleEdge1 = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "triangle-edge", marks);
  const triangleEdge2 = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "triangle-edge", marks);
  const triangleEdge3 = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "triangle-edge", marks);
  const rightMark = board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 10, "right-mark", marks);
  const hypotenuseSquare = board.polygon([], "outline outline-final", outlines);

  const pieceShapes = [];
  for (let i = 0; i < 7; i++) {
    pieceShapes.push(board.polygon([], "piece " + (i >= 5 ? "piece-small" : "piece-big"), piecesLayer));
  }
  const aLabel = board.label({ x: 0, y: 0 }, "a", "dim", 0, -8, labels);
  const bLabel = board.label({ x: 0, y: 0 }, "b", "dim", 8, 0, labels);
  const cLabel = board.label({ x: 0, y: 0 }, "c", "dim", -10, -6, labels);
  const leftCaption = board.label({ x: OX + 40, y: OY + 26 }, "two squares", "caption", 0, 0, labels);
  const rightCaption = board.label({ x: OX + AT.x + 40, y: OY + AT.y - 14 },
    "square on c", "caption", 0, 0, labels);

  /**
   * Shows a line under the game. Without a kind this is just information;
   * a demo has nothing to win or lose, so "win"/"lose" are never used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const s = state;
    const d = Core.dissection(s.a, s.b, AT);
    const q = d.points;
    const ready = Core.aligned(s);
    const total = anim ? clamp((performance.now() - anim.t0) / DURATION, 0, 1) : (s.assembled ? 1 : 0);

    bigSquare.set([q.A, q.B, q.C, q.D].map(abs));
    smallSquare.set([q.A, q.B1, q.C1, q.D1].map((p) => shifted(p, s.gap)));

    const A = abs(q.A), B = abs(q.B), E = abs(q.E);
    triangleFill.set([A, B, E]).show(true);
    triangleEdge1.set(A, B);
    triangleEdge2.set(B, E);
    triangleEdge3.set(E, A);
    rightMark.set(B, A, E, 9);
    aLabel.set(mid(A, B), "a", 0, -8);
    bLabel.set(mid(B, E), "b", 9, 0);
    cLabel.set(mid(A, E), "c", -12, -4);
    leftCaption.set({ x: OX + 40, y: OY + 26 }, "two squares", 0, 0);
    rightCaption.set({ x: OX + AT.x + 40, y: OY + AT.y - 14 }, "square on c", 0, 0);

    hypotenuseSquare.set(d.square.map(abs)).show(ready && total > 0);
    pieceShapes.forEach((shape, i) => {
      const piece = d.pieces[i];
      const t = clamp(total * d.pieces.length - i, 0, 1);
      const vertices = piece.start.map((p, k) => abs(lerp(p, piece.end[k], t)));
      shape.set(vertices).show(ready);
    });

    cornerHandle.set(abs(s.gap));
    aHandle.set(abs(Core.pt(s.a, 0)));
    bHandle.set(abs(Core.pt(s.a, -s.b)));

    const id = Core.identity(s.a, s.b);
    readoutEl.textContent = `${fmt(s.a)}² + ${fmt(s.b)}² = ${fmt(id.c)}²  ·  both areas ${fmt(id.c2)}`;
    if (!ready) {
      say("Slide the small square's corner onto the big square's corner to see the seven pieces.");
    } else if (!anim && !s.assembled) {
      say("The corners meet. Press Move them to slide the seven pieces across.");
    } else if (total < 1) {
      say("The pieces keep their shape and area as they move.");
    } else {
      say("The two squares have become the square on the third side: a² + b² = c².");
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function cancelAnimation() {
    anim = null;
    state = { ...state, assembled: false };
  }

  function cornerDrag(p) {
    cancelAnimation();
    state = Core.withGap(state, p.x - OX, p.y - OY);
    render();
  }
  function sideADrag(p) {
    cancelAnimation();
    state = Core.withSide(state, "a", p.x - OX);
    render();
  }
  function sideBDrag(p) {
    cancelAnimation();
    state = Core.withSide(state, "b", OY - p.y);
    render();
  }

  const cornerHandle = board.handle("A1", abs(state.gap), {
    r: 16, step: 5, shift: 4, cls: "geom-handle move-handle",
    label: "Small square corner. Drag it, or focus it and use the arrow keys, to meet the big square's corner.",
    describe: (p) => `x ${Math.round(p.x - OX)}, y ${Math.round(p.y - OY)}`,
    clamp: (p) => ({ x: clamp(p.x, OX - 20, OX + 250), y: clamp(p.y, OY - 130, OY + 20) }),
    layer: handlesLayer, onMove: cornerDrag,
  });
  const aHandle = board.handle("B", abs(Core.pt(state.a, 0)), {
    r: 16, step: 4, shift: 3, cls: "geom-handle resize-handle",
    label: "Point B. Drag it, or focus it and use the arrow keys, to change side a, from 40 to 150.",
    describe: (p) => `a ${Math.round(p.x - OX)}`,
    clamp: (p) => ({ x: clamp(p.x, OX + Core.LIMITS.minA, OX + Core.LIMITS.maxA), y: OY }),
    layer: handlesLayer, onMove: sideADrag,
  });
  const bHandle = board.handle("E", abs(Core.pt(state.a, -state.b)), {
    r: 16, step: 4, shift: 3, cls: "geom-handle resize-handle",
    label: "Point E. Drag it, or focus it and use the arrow keys, to change side b, from 20 up to a minus 10.",
    describe: (p) => `b ${Math.round(OY - p.y)}`,
    clamp: (p) => ({ x: OX + state.a, y: clamp(p.y, OY - (state.a - Core.LIMITS.gap), OY - Core.LIMITS.minB) }),
    layer: handlesLayer, onMove: sideBDrag,
  });

  function tick() {
    if (!anim) return;
    const t = (performance.now() - anim.t0) / DURATION;
    if (t >= 1) {
      anim = null;
      state = { ...state, assembled: true };
      render();
      return;
    }
    render();
    requestAnimationFrame(tick);
  }

  moveBtn.addEventListener("click", () => {
    if (!Core.aligned(state)) {
      say("First slide the small square's corner onto the big square's corner.");
      return;
    }
    if (anim) return;
    anim = { t0: performance.now() };
    requestAnimationFrame(tick);
  });
  resetBtn.addEventListener("click", () => {
    anim = null;
    state = Core.start();
    render();
  });

  // The same shapes are used on a theme flip, because they are styled with
  // CSS classes; this hook keeps any computed drawing in step with the theme.
  board.onTheme(render);

  render();
})();
