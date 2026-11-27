"use strict";

/*
 * The page for From Grebe: drawing and input only. The geometry lives in
 * from-grebe-core.js. The stage holds one SVG: A', B' and C' are draggable,
 * focusable handles and every other point is rebuilt from them. The three
 * squares, the outer sides, the lines through K and the smaller triangle ABC
 * are all drawn in the applet's own order. Nothing is won or lost here; the
 * status line reports the common point and the scale of the copy.
 */

(function () {
  const C = FromGrebeCore;
  const statusEl = document.getElementById("status");
  const namesCheck = document.getElementById("namesCheck");
  const newBtn = document.getElementById("newBtn");

  let state = C.start({});

  /** The line under the picture. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const board = Geom.board(document.getElementById("board"));
  /* Layers are made in paint order. Every object is created once and moved
     with .set(), so a handle keeps keyboard focus across a redraw. */
  const guideLayer = board.layer("guides");
  const squareLayer = board.layer("squares");
  const spokeLayer = board.layer("spokes");
  const reconLayer = board.layer("reconstruction");
  const lineLayer = board.layer("lines");
  const dotLayer = board.layer("dots");
  const textLayer = board.layer("text");
  const tops = board.layer("handles");

  const initial = C.construct(state.A, state.B, state.C);
  const outerLines = [0, 1, 2].map(() => board.line(initial.As[0][0], initial.As[0][1], "outer-line", guideLayer));
  const squares = [0, 1, 2].map(() => board.polygon([initial.A, initial.B], "square", squareLayer));
  const spokes = Array.from({ length: 9 },
    () => board.line(initial.K, initial.As[0][0], "spoke", spokeLayer));
  const reconSides = Array.from({ length: 6 },
    () => board.segment(initial.S[0][0], initial.Ap[0], "recon-side", reconLayer));
  const recon = board.polygon(initial.Ap, "recon", reconLayer);
  const given = board.polygon([initial.A, initial.B, initial.C], "given", lineLayer);
  const apDots = [0, 1, 2].map(() => board.point(initial.Ap[0], "dot-ap", 4.2, dotLayer));
  const asDots = Array.from({ length: 6 },
    () => board.point(initial.As[0][0], "dot-as", 3.5, dotLayer));
  const sDots = Array.from({ length: 6 },
    () => board.point(initial.S[0][0], "dot-s", 2.6, dotLayer));
  const kDot = board.point(initial.K, "dot-k", 4, dotLayer);

  const labelShapes = [];
  for (let i = 0; i < 3; i++) {
    labelShapes.push(board.label(initial.Ap[i], C.NAMES[i], "pt-label", 6, -8, textLayer));
    labelShapes.push(board.label(initial.A, C.PRIMES[i], "pt-label", 7, -9, textLayer));
    labelShapes.push(board.label(initial.P[i], C.ZEROS[i], "pt-label label-zero", 7, -8, textLayer));
    labelShapes.push(board.label(initial.S[i][0], "", "pt-label label-cut", 6, -6, textLayer));
    labelShapes.push(board.label(initial.S[i][1], "", "pt-label label-cut", 6, 14, textLayer));
  }
  const clip = (p) => C.clampToBoard(p);
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const vertexMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["A", "B", "C"].map((n) => [n,
    board.handle(n, state[n], {
      r: 12, step: 5, layer: tops, clamp: clip, describe, onMove: vertexMove,
      label: `Vertex ${C.PRIMES[["A", "B", "C"].indexOf(n)]} of the draggable triangle. Drag it, or focus it and use the arrow keys to move it`,
    })]));

  // The applet also drags the whole triangle. An invisible copy of it catches
  // the pointer; the handles stay above it and keep their own dragging.
  const dragPatch = board.polygon([initial.A, initial.B, initial.C], "tri-drag", tops);
  // The patch must sit below the three handles so those keep their own drag.
  dragPatch.node.parentNode.insertBefore(dragPatch.node, handles.A.node);
  let dragging = null;
  dragPatch.node.addEventListener("pointerdown", (e) => {
    dragging = { id: e.pointerId, at: board.toLocal(e.clientX, e.clientY) };
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== dragging.id) return;
    const at = board.toLocal(e.clientX, e.clientY);
    state = C.moveAll(state, at.x - dragging.at.x, at.y - dragging.at.y);
    dragging.at = at;
    render();
    e.preventDefault();
  });
  const stopDrag = (e) => { if (dragging && e.pointerId === dragging.id) dragging = null; };
  board.root.addEventListener("pointerup", stopDrag);
  board.root.addEventListener("pointercancel", stopDrag);
  board.root.addEventListener("lostpointercapture", stopDrag);

  function place(shape, p, words, dx, dy, visible) {
    shape.show(Boolean(visible));
    if (visible) shape.set(p, words, dx, dy);
  }

  function render() {
    const g = C.construct(state.A, state.B, state.C);
    say(C.label(g));
    const shapes = [outerLines, squares, spokes, reconSides, recon, given,
      apDots, asDots, sDots, [kDot]].flat();
    shapes.forEach((s) => s.show(g.valid));
    labelShapes.forEach((s) => s.show(false));

    if (g.valid) {
      const T = [g.A, g.B, g.C];
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        outerLines[i].set(g.As[i][0], g.As[i][1]);
        squares[i].set([T[i], g.As[i][0], g.As[i][1], T[j]]);
        for (let k = 0; k < 2; k++) {
          spokes[i * 3 + k].set(g.K, g.As[i][k]);
          asDots[i * 2 + k].set(g.As[i][k]);
          sDots[i * 2 + k].set(g.S[i][k]);
        }
        spokes[i * 3 + 2].set(g.K, g.P[i]);
        reconSides[i * 2].set(g.S[i][0], g.Ap[i]);
        reconSides[i * 2 + 1].set(g.S[i][1], g.Ap[j]);
        apDots[i].set(g.Ap[i]);
        place(labelShapes[i * 5], g.Ap[i], C.NAMES[i], 7, -8, state.options.names);
        place(labelShapes[i * 5 + 1], T[i], C.PRIMES[i], 8, -9, state.options.names);
        place(labelShapes[i * 5 + 2], g.P[i], C.ZEROS[i], 7, -8, state.options.names);
        const cut = (i + 2) % 3;
        place(labelShapes[i * 5 + 3], g.S[i][0],
          C.NAMES[cut] + C.SUBS[i], 6, -6, state.options.names);
        place(labelShapes[i * 5 + 4], g.S[i][1],
          C.NAMES[cut] + C.SUBS[j], 6, 14, state.options.names);
      }
      recon.set(g.Ap);
      given.set(T);
      dragPatch.set(T);
      kDot.set(g.K);
    }

    for (const n of ["A", "B", "C"]) handles[n].set(state[n]);
    dragPatch.show(g.valid);
    namesCheck.checked = state.options.names;

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C,
        options: { names: state.options.names },
        K: g.valid ? g.K : null,
      });
    }
  }

  namesCheck.addEventListener("change", () => {
    state = C.setOption(state, "names", namesCheck.checked);
    render();
  });

  newBtn.addEventListener("click", () => {
    state = C.start({ names: state.options.names });
    render();
  });

  board.onTheme(render);
  render();
})();
