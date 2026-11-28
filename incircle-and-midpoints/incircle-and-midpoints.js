"use strict";

/*
 * Browser UI for Midpoints from the Gergonne triangle. The construction and
 * the numbers live in incircle-and-midpoints-core.js; this file only draws
 * them and takes input.
 *
 * Drag A, B or C. The inset circle, its three touch points M, N, K and the
 * lines through A parallel to MN and KN are rebuilt from the new triangle.
 * The red line DE always cuts AB and AC at their midpoints F and G. The
 * checkboxes are the applet's own "names", "hint 1" and "hint 2" options.
 */

(() => {
  const C = IncircleAndMidpointsCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const toggles = {
    names: document.getElementById("namesCheck"),
    hint1: document.getElementById("hint1Check"),
    hint2: document.getElementById("hint2Check"),
  };

  const board = Geom.board(document.getElementById("board"));
  const fill = board.layer("fill");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const accents = board.layer("accents");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start();

  /** Write the status line. "win", "lose" and "done" are the record's signals. */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  /* Each object is made once and then moved with .set(), so a handle keeps
     keyboard focus across a redraw. */
  const tri = board.polygon([state.A, state.B, state.C], "tri-fill", fill);
  const incircle = board.circle(state.A, 1, "incircle", circles);

  const hintLines = [
    board.line(state.A, state.B, "hint2-line", guides),
    board.line(state.A, state.B, "hint2-line", guides),
    board.line(state.A, state.B, "hint2-line", guides),
  ];
  const parallels = [
    board.line(state.A, state.B, "parallel-line", guides),
    board.line(state.A, state.B, "parallel-line", guides),
  ];
  const touchSpans = [
    board.segment(state.A, state.B, "touch-line", accents),
    board.segment(state.A, state.B, "touch-line", accents),
  ];
  const deLine = board.line(state.A, state.B, "de-line", accents);

  const touchDots = ["M", "N", "K"].map(() => board.point(state.A, "touch-dot", 4, dots));
  const midDots = ["F", "G"].map(() => board.point(state.A, "mid-dot", 4.6, dots));
  const hintDots = ["D", "E", "U", "V"].map(() => board.point(state.A, "hint-dot", 3.6, dots));

  // Equal-length tick marks: one across BN and BM, two across CN and CK.
  const marks = [];
  for (let i = 0; i < 6; i++) marks.push(board.segment(state.A, state.B, "tick", accents));
  function tick(p, q, count, index) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const shift = count === 1 ? 0 : (index % 2 === 0 ? -3 : 3);
    const c = {
      x: p.x + ux * (len / 2 + shift),
      y: p.y + uy * (len / 2 + shift),
    };
    return [
      { x: c.x - 4 * nx, y: c.y - 4 * ny },
      { x: c.x + 4 * nx, y: c.y + 4 * ny },
    ];
  }

  // Equal-angle arcs for the hint-2 similarity argument.
  const arcs = [];
  for (let i = 0; i < 6; i++) arcs.push(board.angleArc(state.A, state.B, state.C, 12, "angle-arc", guides));

  const named = ["A", "B", "C", "D", "E", "F", "G", "K", "M", "N", "U", "V"];
  const text = Object.fromEntries(named.map((n) =>
    [n, board.label(state.A, n, "pt-label", 7, -7, labels)]));
  const offsets = {
    A: [-16, -11], B: [-15, 19], C: [-17, -11],
    D: [6, -9], E: [7, 15], F: [-17, 18], G: [7, -10],
    K: [7, -9], M: [-16, -9], N: [7, 16], U: [-17, -9], V: [7, -9],
  };

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p) => `at x ${Math.round(p.x)}, y ${Math.round(p.y)} in the drawing`;
  const onMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handlesById = {
    A: board.handle("A", state.A, { r: 9, step: 5, shift: 25, layer: handlesLayer, clamp, describe, onMove,
      label: "Vertex A — drag it, or focus it and use the arrow keys to move it" }),
    B: board.handle("B", state.B, { r: 9, step: 5, shift: 25, layer: handlesLayer, clamp, describe, onMove,
      label: "Vertex B — drag it, or focus it and use the arrow keys to move it" }),
    C: board.handle("C", state.C, { r: 9, step: 5, shift: 25, layer: handlesLayer, clamp, describe, onMove,
      label: "Vertex C — drag it, or focus it and use the arrow keys to move it" }),
  };

  function place(name, p) {
    const label = text[name];
    label.show(Boolean(p));
    if (p) label.set(p, name, offsets[name][0], offsets[name][1]);
  }

  function render() {
    const g = C.geometry(state);
    const o = state.options;

    for (const name of ["A", "B", "C"]) handlesById[name].set(state[name]);
    for (const name of named) text[name].show(false);
    tri.show(g.valid);
    incircle.show(false);
    for (const s of hintLines) s.show(false);
    for (const s of parallels) s.show(false);
    for (const s of touchSpans) s.show(false);
    for (const s of marks) s.show(false);
    for (const a of arcs) a.show(false);
    deLine.show(false);
    for (const d of touchDots) d.show(false);
    for (const d of midDots) d.show(false);
    for (const d of hintDots) d.show(false);

    if (!g.valid) {
      say("Move A, B and C so they form a triangle; the drawing cannot be made from a straight line.");
    } else {
      tri.set([g.A, g.B, g.C]);
      deLine.set(g.lines.DE[0], g.lines.DE[1]);
      deLine.show(true);

      // DoubLine AMN runs through A and E; AKN runs through A and D.
      parallels[0].set(g.lines.AMN[0], g.lines.AMN[1]);
      parallels[1].set(g.lines.AKN[0], g.lines.AKN[1]);
      for (const s of parallels) s.show(true);

      if (!o.hint2) {
        touchSpans[0].set(g.spans.MDN[0], g.spans.MDN[1]);
        touchSpans[1].set(g.spans.KEN[0], g.spans.KEN[1]);
        for (const s of touchSpans) s.show(true);
      }

      if (o.hint1) {
        incircle.set(g.I, g.radius);
        incircle.show(true);
        const pairs = [
          [g.B, g.N, 1, 0], [g.B, g.M, 1, 0],
          [g.C, g.N, 2, 0], [g.C, g.N, 2, 1],
          [g.C, g.K, 2, 0], [g.C, g.K, 2, 1],
        ];
        for (let i = 0; i < pairs.length; i++) {
          const [p, q, count, index] = pairs[i];
          marks[i].set(...tick(p, q, count, index));
          marks[i].show(true);
        }
      }

      if (o.hint2) {
        const hl = [g.lines.MN, g.lines.KN, g.lines.UV];
        for (let i = 0; i < hl.length; i++) {
          hintLines[i].set(hl[i][0], hl[i][1]);
          hintLines[i].show(true);
        }
        const angleSets = [
          [g.C, g.N, g.K, 12], [g.C, g.N, g.K, 18],
          [g.A, g.V, g.K, 12], [g.A, g.V, g.K, 18],
          [g.B, g.N, g.M, 12], [g.A, g.U, g.M, 12],
        ];
        for (let i = 0; i < angleSets.length; i++) {
          arcs[i].set(...angleSets[i]);
          arcs[i].show(true);
        }
      }

      for (let i = 0; i < 3; i++) {
        touchDots[i].set([g.M, g.N, g.K][i]);
        touchDots[i].show(true);
      }
      for (let i = 0; i < 2; i++) {
        midDots[i].set([g.F, g.G][i]);
        midDots[i].show(true);
      }
      const extras = [g.D, g.E, g.U, g.V];
      for (let i = 0; i < extras.length; i++) {
        hintDots[i].set(extras[i]);
        hintDots[i].show(i < 2 || o.hint2);
      }

      if (o.names) {
        for (const n of ["A", "B", "C"]) place(n, g[n]);
        // The applet hides a label when another dot sits almost on top of it.
        if (C.dist(g.M, g.D) > 5) place("D", g.D);
        if (C.dist(g.M, g.F) > 5) place("F", g.F);
        if (C.dist(g.K, g.E) > 5) place("E", g.E);
        if (C.dist(g.K, g.G) > 5) place("G", g.G);
        for (const n of ["M", "N", "K"]) place(n, g[n]);
        if (o.hint2) { place("U", g.U); place("V", g.V); }
      }

      const err = C.claimErrors(g);
      say(`DE cuts AB and AC at their midpoints: AF = FB, AG = GC ` +
        `(largest difference ${Math.max(err.FmidAB, err.GmidAC).toExponential(1)}). ` +
        `Turn on the hints to see why.`);
    }

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ A: state.A, B: state.B, C: state.C, options: state.options });
    }
  }

  for (const name in toggles) {
    const box = toggles[name];
    box.checked = state.options[name];
    box.addEventListener("change", () => {
      state = C.setOption(state, name, box.checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = C.start();
    for (const name in toggles) toggles[name].checked = state.options[name];
    render();
  });

  board.onTheme(render);
  render();
})();
