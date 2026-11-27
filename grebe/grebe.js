"use strict";

/*
 * The page for Grebe: drawing and input only. The geometry lives in
 * grebe-core.js. The stage holds one SVG: A, B and C are draggable, focusable
 * handles and everything else is rebuilt from them. The three squares, the
 * outer sides, the lines through K and the van Lamoen modes are drawn in the
 * applet's own order. Nothing is won or lost here; the status line reports
 * the invariant of the selected mode.
 */

(function () {
  const C = GrebeCore;
  const statusEl = document.getElementById("status");
  const namesCheck = document.getElementById("namesCheck");
  const newBtn = document.getElementById("newBtn");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

  let state = C.start({});

  /** The line under the picture. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const board = Geom.board(document.getElementById("board"));
  /* Layers are made in paint order. Each object is created once and moved
     with .set(), so a handle keeps keyboard focus across a redraw. */
  const squareLayer = board.layer("squares");
  const guideLayer = board.layer("guides");
  const spokeLayer = board.layer("spokes");
  const triangleLayer = board.layer("triangle");
  const dotLayer = board.layer("dots");
  const textLayer = board.layer("text");
  const tops = board.layer("handles");

  const initial = C.construct(state.A, state.B, state.C);
  const T0 = [initial.A, initial.B, initial.C];
  const squares = [0, 1, 2].map(() => board.polygon(T0, "square", squareLayer));
  const outerLines = [0, 1, 2].map(() => board.line(initial.K, initial.primes[0], "outer-line", guideLayer));
  const redLines = [0, 1, 2].map(() => board.line(initial.corners.AB, initial.corners.CB, "red-line", guideLayer));
  const midLines = [0, 1, 2].map(() => board.line(initial.K, initial.flankCentres[0], "mid-line", guideLayer));
  const spokes = [0, 1, 2].map(() => board.line(initial.K, initial.primes[0], "spoke", spokeLayer));
  const triangle = board.polygon(T0, "triangle", triangleLayer);
  const primeDots = [0, 1, 2].map(() => board.point(initial.primes[0], "dot-mode", 4.2, dotLayer));
  const centreDots = [0, 1, 2].map(() => board.point(initial.flankCentres[0], "dot-mode", 4.4, dotLayer));
  const flankDots = [0, 1, 2].map(() => board.point(initial.flankK[0], "dot-mode", 4.2, dotLayer));
  const keyDot = board.point(initial.K, "dot-key", 5.2, dotLayer);

  const labels = [];
  for (let i = 0; i < 3; i++) {
    labels.push(board.label(T0[i], C.NAMES[i], "pt-label", 7, -9, textLayer));         // A, B, C
    labels.push(board.label(T0[i], C.PRIMES[i], "pt-label", 7, -9, textLayer));        // A', B', C'
    labels.push(board.label(T0[i], C.CENTRES[i], "pt-label", 7, -9, textLayer));       // O_a, O_b, O_c
    labels.push(board.label(T0[i], C.FLANKS[i], "pt-label", 7, -9, textLayer));        // K_a, K_b, K_c
  }
  const keyLabel = board.label(initial.K, "K", "pt-label label-key", 8, -9, textLayer);

  const clip = (p) => C.clampToBoard(p);
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down in the drawing`;
  const vertexMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handles = Object.fromEntries(["A", "B", "C"].map((n) => [n,
    board.handle(n, state[n], {
      r: 12, step: 5, layer: tops, clamp: clip, describe, onMove: vertexMove,
      label: `Vertex ${n} of the draggable triangle. Drag it, or focus it and use the arrow keys to move it`,
    })]));

  /* The applet also drags the whole triangle. An invisible copy of it catches
     the pointer; the handles stay above it and keep their own dragging. */
  const dragPatch = board.polygon(T0, "tri-drag", tops);
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

  function place(shape, p, words, visible) {
    shape.show(Boolean(visible));
    if (visible) shape.set(p, words, 7, -9);
  }

  function render() {
    const g = C.construct(state.A, state.B, state.C);
    const mode = state.options.mode;
    const names = state.options.names;
    say(C.label(g, mode));

    const all = [squares, outerLines, redLines, midLines, spokes, [triangle],
      primeDots, centreDots, flankDots, [keyDot], [keyLabel], labels].flat();
    all.forEach((s) => s.show(false));

    if (g.valid) {
      const T = [g.A, g.B, g.C];
      const co = g.corners;
      // Draw(): A-B-CA-CB, B-C-AB-AC, C-A-BC-BA.
      squares[0].set([T[0], co.CA, co.CB, T[1]]);
      squares[1].set([T[1], co.AB, co.AC, T[2]]);
      squares[2].set([T[2], co.BC, co.BA, T[0]]);
      squares.forEach((s) => s.show(true));
      triangle.set(T).show(true);
      dragPatch.set(T).show(true);

      if (mode === "grebe") {
        // DrawGrebe(): the far side of each square, then the three cevians.
        const outer = [[co.AB, co.AC], [co.BA, co.BC], [co.CA, co.CB]];
        outer.forEach((pair, i) => outerLines[i].set(pair[0], pair[1]).show(true));
        spokes.forEach((s, i) => {
          s.set(g.K, g.primes[i]).show(true);
          primeDots[i].set(g.primes[i]).show(true);
        });
        keyDot.set(g.K).show(true);
        keyLabel.set(g.K, "K", 8, -9).show(names);
      } else {
        // DrawVanLamoen(): red lines between far corners of neighbouring squares.
        const red = [[co.AB, co.CB], [co.CA, co.BA], [co.BC, co.AC]];
        red.forEach((pair, i) => redLines[i].set(pair[0], pair[1]).show(true));
        if (mode === "OK") {
          const mid = (p, q) => C.midpoint(p, q);
          const mids = [[mid(T[1], co.AB), mid(T[2], co.AC)],
            [mid(T[2], co.BC), mid(T[0], co.BA)],
            [mid(T[0], co.CA), mid(T[1], co.CB)]];
          mids.forEach((pair, i) => midLines[i].set(pair[0], pair[1]).show(true));
          spokes.forEach((s, i) => {
            s.set(g.K, g.flankCentres[i]).show(true);
            centreDots[i].set(g.flankCentres[i]).show(true);
          });
          keyDot.set(g.K).show(true);
          keyLabel.set(g.K, "K", 8, -9).show(names);
        } else {
          spokes.forEach((s, i) => {
            s.set(g.O, g.flankK[i]).show(true);
            flankDots[i].set(g.flankK[i]).show(true);
          });
          keyDot.set(g.O).show(true);
          keyLabel.set(g.O, "O", 8, -9).show(names);
        }
      }

      const words = mode === "grebe" ? C.PRIMES
        : mode === "OK" ? C.CENTRES : C.FLANKS;
      for (let i = 0; i < 3; i++) {
        place(labels[i * 4], T[i], C.NAMES[i], names);
        const p = mode === "grebe" ? g.primes[i]
          : mode === "OK" ? g.flankCentres[i] : g.flankK[i];
        place(labels[i * 4 + 1], p, words[i], names);
      }
    }

    for (const n of ["A", "B", "C"]) handles[n].set(state[n]);
    namesCheck.checked = names;
    for (const input of modeInputs) input.checked = input.value === mode;

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C,
        options: { names: names, mode: mode },
        K: g.valid ? g.K : null,
      });
    }
  }

  namesCheck.addEventListener("change", () => {
    state = C.setOption(state, "names", namesCheck.checked);
    render();
  });
  modeInputs.forEach((input) => input.addEventListener("change", () => {
    if (input.checked) {
      state = C.setOption(state, "mode", input.value);
      render();
    }
  }));
  newBtn.addEventListener("click", () => {
    state = C.start({ names: state.options.names, mode: state.options.mode });
    render();
  });

  board.onTheme(render);
  render();
})();
