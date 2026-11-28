"use strict";

/*
 * Browser UI for Concurrency in the Intouch Triangle. The construction and
 * all the numbers live in intouch-medians-core.js; this file only draws them
 * and takes input.
 *
 * Drag A, B or C. The incircle, its three touch points A', B', C', the
 * midpoints Am, Bm, Cm of the intouch triangle and the three perpendiculars
 * to the opposite sides are rebuilt from the new triangle. The two checkboxes
 * are the applet's own "names" and "hint" options: hint adds the medians of
 * the intouch triangle, the radii through the touch points, the line SI and
 * the equal-length marks that carry the proof.
 */

(() => {
  const C = IntouchMediansCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const toggles = {
    names: document.getElementById("namesCheck"),
    hint: document.getElementById("hintCheck"),
  };

  const board = Geom.board(document.getElementById("board"));
  const fill = board.layer("fill");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const accents = board.layer("accents");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start();

  /** Show a line under the picture. There is no win or loss in an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  /* Each object is made once and then moved with .set(), so a handle keeps
     keyboard focus across a redraw. */
  const tri = board.polygon([state.A, state.B, state.C], "tri-fill", fill);
  const incircle = board.circle(state.A, 1, "incircle", circles);

  const perps = [0, 1, 2].map(() => board.line(state.A, state.B, "perp-line", guides));
  const touchSides = [0, 1, 2].map(() => board.segment(state.A, state.B, "touch-line", accents));
  const medians = [0, 1, 2].map(() => board.segment(state.A, state.B, "median-line", guides));
  const radii = [0, 1, 2].map(() => board.segment(state.A, state.B, "radius-line", guides));
  const siLine = board.line(state.A, state.B, "si-line", accents);
  const ticks = [0, 1, 2, 3, 4, 5].map(() => board.segment(state.A, state.B, "tick", marks));

  const touchDots = ["Ap", "Bp", "Cp"].map(() => board.point(state.A, "touch-dot", 4.2, dots));
  const midDots = ["Am", "Bm", "Cm"].map(() => board.point(state.A, "mid-dot", 4.2, dots));
  const footDots = ["Ah", "Bh", "Ch"].map(() => board.point(state.A, "foot-dot", 3.8, dots));
  const sDot = board.point(state.A, "s-dot", 5, dots);
  const iDot = board.point(state.A, "center-dot", 4.5, dots);
  const gDot = board.point(state.A, "center-dot", 4.5, dots);

  const named = ["A", "B", "C", "S", "I", "G", "A'", "B'", "C'", "Am", "Bm", "Cm", "Ah", "Bh", "Ch"];
  const text = Object.fromEntries(named.map((n) =>
    [n, board.label(state.A, n, "pt-label", 7, -7, labels)]));
  const offsets = {
    A: [-18, 20], B: [6, 20], C: [-8, -12], S: [9, -9], I: [7, 17], G: [-22, -17],
    "A'": [7, -8], "B'": [-20, -8], "C'": [-8, 18],
    Am: [-20, 18], Bm: [7, -10], Cm: [7, 16],
    Ah: [6, -8], Bh: [-20, -8], Ch: [6, 17],
  };

  // The six equal pieces carry 1, 2 or 3 ticks, as in the applet's LineID.
  function tick(p, q, count, index) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const shift = count === 1 ? 0 : (index % 2 === 0 ? -3.5 : 3.5);
    const c = { x: p.x + ux * (len / 2 + shift), y: p.y + uy * (len / 2 + shift) };
    return [
      { x: c.x - 4 * nx, y: c.y - 4 * ny },
      { x: c.x + 4 * nx, y: c.y + 4 * ny },
    ];
  }

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
    tri.show(false);
    incircle.show(false);
    for (const s of perps) s.show(false);
    for (const s of touchSides) s.show(false);
    for (const s of medians) s.show(false);
    for (const s of radii) s.show(false);
    for (const s of ticks) s.show(false);
    siLine.show(false);
    for (const d of touchDots) d.show(false);
    for (const d of midDots) d.show(false);
    for (const d of footDots) d.show(false);
    sDot.show(false);
    iDot.show(false);
    gDot.show(false);

    if (!g.valid) {
      say("Move A, B and C so they form a triangle; the drawing cannot be made from a straight line.");
    } else {
      tri.set([g.A, g.B, g.C]);
      tri.show(true);
      incircle.set(g.I, g.radius);
      incircle.show(true);

      for (let i = 0; i < 3; i++) {
        perps[i].set(...g.lines.perp[i]);
        perps[i].show(true);
        touchSides[i].set(...g.lines.touch[i]);
        touchSides[i].show(true);
        const spans = [g.Ap, g.Bp, g.Cp];
        touchDots[i].set(spans[i]);
        touchDots[i].show(true);
        const mids = [g.Am, g.Bm, g.Cm];
        midDots[i].set(mids[i]);
        midDots[i].show(true);
        const feet = [g.Ah, g.Bh, g.Ch];
        footDots[i].set(feet[i]);
        footDots[i].show(true);
      }
      sDot.set(g.S);
      sDot.show(true);

      if (o.hint) {
        for (let i = 0; i < 3; i++) {
          medians[i].set(...g.lines.medians[i]);
          medians[i].show(true);
          radii[i].set(...g.lines.radii[i]);
          radii[i].show(true);
        }
        for (let i = 0; i < 6; i++) {
          const [p, q, count] = g.lines.marks[i];
          ticks[i].set(...tick(p, q, count, i));
          ticks[i].show(true);
        }
        siLine.set(...g.lines.SI);
        siLine.show(true);
        iDot.set(g.I);
        iDot.show(true);
        gDot.set(g.G);
        gDot.show(true);
      }

      if (o.names) {
        for (const n of ["A", "B", "C", "S", "A'", "B'", "C'", "Am", "Bm", "Cm"]) {
          place(n, g.labels[n]);
        }
        // As in the applet, a label is dropped when another dot sits on it.
        const apart = (p, q, d) => C.dist(p, q) > d;
        if (apart(g.Ah, g.Ap, 7)) place("Ah", g.Ah);
        if (apart(g.Bh, g.Bp, 7)) place("Bh", g.Bh);
        if (apart(g.Ch, g.Cp, 7)) place("Ch", g.Ch);
        if (o.hint) {
          place("I", g.I);
          if (apart(g.G, g.S, 9)) place("G", g.G);
        }
      }

      const err = C.claimErrors(g);
      say(`The three perpendiculars meet at S, and G' lies on SI with ` +
        `2 × SG' = G'I (largest difference ${Math.max(err.concurrency, err.ratio).toExponential(1)}). ` +
        `Turn on hint to see the medians and radii behind it.`);
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
