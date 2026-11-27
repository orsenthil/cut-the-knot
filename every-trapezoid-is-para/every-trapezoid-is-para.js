"use strict";

/*
 * Every Trapezoid Is Para — drawing and input only; the geometry is in
 * every-trapezoid-is-para-core.js. Four draggable corners keep AD parallel to
 * BC; E and F are the equal extensions of the bases, and G and H are the two
 * crossings on AC. The checkboxes reproduce the applet's Show options, with
 * matching tick marks on the equal segments and dashed lines for the hint.
 * Every SVG object is made once and only updated on a redraw, so a handle
 * keeps keyboard focus while the other corners move.
 */

(function () {
  const Core = EveryTrapezoidIsParaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    showNames: document.getElementById("names"),
    showStatement: document.getElementById("statement"),
    showPremise: document.getElementById("premise"),
    showHint: document.getElementById("hint"),
  };
  const newBtn = document.getElementById("newBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const hints = board.layer("hints");
  const guides = board.layer("guides");
  const diagonals = board.layer("diagonals");
  const marks = board.layer("marks");
  const points = board.layer("points");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const shade = board.polygon([state.A, state.B, state.C, state.D], "trapezoid", fills);
  const edges = [
    board.segment(state.A, state.B, "edge", diagonals),
    board.segment(state.B, state.C, "edge", diagonals),
    board.segment(state.C, state.D, "edge", diagonals),
    board.segment(state.D, state.A, "edge", diagonals),
  ];
  const extAF = board.segment(state.A, state.F || state.A, "extension", guides);
  const extCE = board.segment(state.C, state.C, "extension", guides);
  const extEF = board.segment(state.A, state.A, "extension", guides);
  const diagBD = board.segment(state.B, state.D, "diagonal", guides);
  const diagAC = board.segment(state.A, state.C, "diagonal", guides);
  const hintLines = [
    board.line(state.A, state.C, "hint", hints),
    board.line(state.B, state.F || state.B, "hint", hints),
    board.line(state.D, state.C, "hint", hints),
  ];
  const auxPoints = [
    board.point(state.A, "aux-point", 3.5, points),
    board.point(state.C, "aux-point", 3.5, points),
    board.point(state.A, "cross-point", 4, points),
    board.point(state.A, "cross-point", 4, points),
  ];

  /* Equality ticks: one on AG and CH, two on AF and BC, three on AD and CE. */
  function tickSet(p, q, count, spacing, length) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const along = { x: dx / d, y: dy / d };
    const across = { x: -along.y, y: along.x };
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const out = [];
    for (let k = 0; k < count; k++) {
      const off = (k - (count - 1) / 2) * spacing;
      const cx = mx + along.x * off, cy = my + along.y * off;
      out.push([
        { x: cx - across.x * length / 2, y: cy - across.y * length / 2 },
        { x: cx + across.x * length / 2, y: cy + across.y * length / 2 },
      ]);
    }
    return out;
  }
  const markSpecs = [
    ["A", "G", 1], ["C", "H", 1],
    ["A", "F", 2], ["B", "C", 2],
    ["A", "D", 3], ["C", "E", 3],
  ];
  const markLines = [];
  /* Three line elements per specification; unused ones are hidden, so a
     checkbox never rebuilds an element a keyboard user may be focused on. */
  for (let i = 0; i < 18; i++) markLines.push(board.segment(state.A, state.A, "mark", marks));

  const labelOffsets = {
    A: [-16, -10], B: [-16, 17], C: [8, 17], D: [8, -10],
    F: [-16, -10], E: [8, 17], G: [-17, -10], H: [8, -10],
  };
  const labelsFor = {};
  for (const key of ["A", "B", "C", "D", "F", "E", "G", "H"]) {
    labelsFor[key] = board.label(state.A, key, "point-label",
      labelOffsets[key][0], labelOffsets[key][1], labels);
  }

  const handles = {};
  for (const key of ["A", "B", "C", "D"]) {
    handles[key] = board.handle(key, state[key], {
      step: 4, shift: 12, r: 10, layer: top,
      clamp: (p) => Core.clampToBoard(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to reshape the trapezoid.`,
      onMove: (p, name) => {
        state = Core.movePoint(state, name, p);
        render();
      },
    });
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.compute(state);
    for (const key of ["A", "B", "C", "D"]) handles[key].set(state[key]);
    shade.set([state.A, state.B, state.C, state.D]);
    edges[0].set(g.A, g.B);
    edges[1].set(g.B, g.C);
    edges[2].set(g.C, g.D);
    edges[3].set(g.D, g.A);

    const ok = g.valid;
    extAF.show(ok).set(g.A, ok ? g.F : g.A);
    extCE.show(ok).set(g.C, ok ? g.E : g.C);
    extEF.show(ok).set(ok ? g.F : g.A, ok ? g.E : g.A);
    diagBD.set(g.B, g.D);
    diagAC.set(g.A, g.C);
    hintLines.forEach((line, i) => line.show(ok && state.showHint));
    if (ok) {
      hintLines[0].set(g.A, g.C);
      hintLines[1].set(g.B, g.F);
      hintLines[2].set(g.D, g.E);
    }
    auxPoints[0].show(ok).set(ok ? g.F : g.A);
    auxPoints[1].show(ok).set(ok ? g.E : g.A);
    auxPoints[2].show(ok).set(ok ? g.G : g.A);
    auxPoints[3].show(ok).set(ok ? g.H : g.A);

    let m = 0;
    const showStatement = ok && state.showStatement;
    const showPremise = ok && state.showPremise;
    for (const spec of markSpecs) {
      const want = spec[2] === 1 ? showStatement : showPremise;
      const pairs = want ? tickSet(g[spec[0]], g[spec[1]], spec[2], 4.5, 11) : [];
      for (let k = 0; k < 3; k++, m++) {
        const pair = pairs[k];
        markLines[m].show(!!pair).set(pair ? pair[0] : g.A, pair ? pair[1] : g.A);
      }
    }
    for (const key of ["A", "B", "C", "D", "F", "E", "G", "H"]) {
      labelsFor[key].show(state.showNames && (ok || "ABCD".includes(key))).set(g[key] || state.A);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The picture, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        E: ok ? g.E : null, F: ok ? g.F : null,
        G: ok ? g.G : null, H: ok ? g.H : null,
        a: ok ? g.a : null, b: ok ? g.b : null,
        x: ok ? g.x : null, z: ok ? g.z : null,
        showNames: state.showNames, showStatement: state.showStatement,
        showPremise: state.showPremise, showHint: state.showHint,
      });
    }
  }

  for (const key of Object.keys(boxes)) {
    boxes[key].checked = state[key];
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  newBtn.addEventListener("click", () => {
    state = Core.randomize(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const key of Object.keys(boxes)) boxes[key].checked = state[key];
    render();
  });

  // SVG colours are classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
