"use strict";

/*
 * The page for Isoperimetric: drawing and input only. The geometry and the
 * length comparisons live in isoperimetric-core.js. The SVG has a baseline, a
 * red curve and up to sixteen blue copies; hollow circles along the baseline
 * (and, in the freehand family, on the curve itself) are focusable handles, so
 * a player can drag them or nudge them with the arrow keys.
 */

(function () {
  const Core = IsoperimetricCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const alternateChk = document.getElementById("alternateChk");
  const reflectChk = document.getElementById("reflectChk");
  const resetBtn = document.getElementById("resetBtn");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const curves = board.layer("curves");
  const handlesLayer = board.layer("handles");

  let state = Core.start({ n: Number(nInput.value) });

  /** The shared status line. This is a picture with no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const pts = (list) => list.map((p) => p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" ");

  function polyline(list, cls) {
    board.el("polyline", { points: pts(list) }, cls, curves);
  }

  function drawArcs(g) {
    const red = g.red[0];
    // Java drawArc(..., 0, 180) draws the half above the baseline (y-down),
    // and start 180 draws the half below it.
    board.arc(mid(red.p, red.q), red.r, Math.PI, 2 * Math.PI, "curve-red", curves);
    for (const piece of g.blue) {
      board.arc(mid(piece.p, piece.q), piece.r,
        piece.below ? 0 : Math.PI, piece.below ? Math.PI : 2 * Math.PI,
        "curve-blue", curves);
    }
  }

  function drawLines(g) {
    const { A, B } = Core.endpoints(state);
    const M = state.apex;
    const d1 = { x: M.x - A.x, y: M.y - A.y };
    const d2 = { x: M.x - B.x, y: M.y - B.y };
    for (const p of state.points) {
      // The two families of guides in the original: parallels to AM and BM.
      board.line(p, { x: p.x + 40 * d1.x, y: p.y + 40 * d1.y }, "guide-parallel", guides);
      board.line(p, { x: p.x + 40 * d2.x, y: p.y + 40 * d2.y }, "guide-parallel", guides);
    }
    polyline([A, M, B], "curve-red");
    const xs = Core.cuts(state);
    const chain = [A];
    for (let i = 0; i < g.apexes.length; i++) {
      chain.push(g.apexes[i], { x: xs[i + 1], y: A.y });
    }
    polyline(chain, "curve-blue");
  }

  function drawSpline(g) {
    polyline(g.red, "curve-red");
    for (const copy of g.blue) polyline(copy, "curve-blue");
  }

  /* The handles are made once and only shown/hidden, so keyboard focus stays. */
  const pointHandles = Array.from({ length: Core.N_MAX }, (_, i) =>
    board.handle("P" + (i + 1), { x: 30 + i * 30, y: 300 }, {
      r: 6, step: 4, shift: 16, layer: handlesLayer,
      label: "Break point " + (i + 1) + ". Drag it along the baseline, or focus it and use the left and right arrow keys.",
      clamp: (q) => {
        const { A, B } = Core.endpoints(state);
        const lo = i === 0 ? A.x + Core.GAP : state.points[i - 1].x + Core.GAP;
        const hi = i === state.n - 1 ? B.x - Core.GAP : state.points[i + 1].x - Core.GAP;
        return { x: Geom.clamp(q.x, lo, hi), y: A.y };
      },
      onMove: (p) => {
        state = Core.move(state, "point", i, p);
        render();
      },
    }));

  const apexHandle = board.handle("M", state.apex, {
    r: 7, step: 4, shift: 16, cls: "geom-handle apex-handle", layer: handlesLayer,
    label: "Top point of the red broken line. Drag it, or focus it and use the arrow keys.",
    clamp: (q) => {
      const { A, B } = Core.endpoints(state);
      return { x: Geom.clamp(q.x, A.x + 8, B.x - 8), y: Geom.clamp(q.y, 8, A.y - 8) };
    },
    onMove: (p) => {
      state = Core.move(state, "apex", 0, p);
      render();
    },
  });

  const splineHandles = state.spline.map((p, i) =>
    board.handle("S" + (i + 1), p, {
      r: 6, step: 3, shift: 12, layer: handlesLayer,
      label: "Freehand point " + (i + 1) + " of 21. Focus it and press the up or down arrow key to move it.",
      clamp: (q) => ({ x: state.spline[i].x, y: Geom.clamp(q.y, 8, state.height - 8) }),
      onMove: (q) => {
        state = Core.move(state, "spline", i, q);
        render();
      },
    }));

  function render() {
    board.clear(guides);
    board.clear(curves);
    const { A, B } = Core.endpoints(state);
    board.segment(A, B, "baseline", guides);
    board.point(A, "end-dot", 3.5, guides);
    board.point(B, "end-dot", 3.5, guides);

    if (state.mode === "arcs") drawArcs(Core.arcs(state));
    else if (state.mode === "lines") drawLines(Core.lines(state));
    else drawSpline(Core.spline(state));

    for (let i = 0; i < pointHandles.length; i++) {
      pointHandles[i].show(i < state.n);
      if (i < state.n) pointHandles[i].set(state.points[i]);
    }
    apexHandle.show(state.mode === "lines");
    if (state.mode === "lines") apexHandle.set(state.apex);
    for (let i = 0; i < splineHandles.length; i++) {
      splineHandles[i].show(state.mode === "spline");
      if (state.mode === "spline") splineHandles[i].set(state.spline[i]);
    }

    const lengths = Core.lengths(state);
    const same = Math.abs(lengths.red - lengths.blue) <= Math.max(0.5, lengths.red * 1e-6);
    say("Red curve " + lengths.red.toFixed(1) + " units; blue curves together " +
      lengths.blue.toFixed(1) + " units — " + (same ? "the same length." : "different lengths."));

    nInput.value = String(state.n);
    reflectChk.disabled = state.mode !== "spline";
    reflectChk.checked = state.reflect;
    alternateChk.checked = state.alternate;
    for (const input of modeInputs) input.checked = input.value === state.mode;

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  for (const input of modeInputs) {
    input.addEventListener("change", () => {
      if (input.checked) {
        state = Core.reset(state, { mode: input.value });
        render();
      }
    });
  }
  function setCount(n) {
    state = Core.reset(state, { n: Geom.clamp(Math.round(n), Core.N_MIN, Core.N_MAX) });
    render();
  }
  minusBtn.addEventListener("click", () => setCount(state.n - 1));
  plusBtn.addEventListener("click", () => setCount(state.n + 1));
  nInput.addEventListener("change", () => setCount(Number(nInput.value)));
  alternateChk.addEventListener("change", () => {
    state = Core.setFlag(state, "alternate", alternateChk.checked);
    render();
  });
  reflectChk.addEventListener("change", () => {
    state = Core.setFlag(state, "reflect", reflectChk.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state, {});
    render();
  });

  board.onTheme(() => render());
  render();
})();
