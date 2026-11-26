"use strict";

/*
 * Broken Chord Mr Homm — the drawing and the input.  All the geometry is in
 * broken-chord-mr-homm-core.js.  A, B and C are draggable; the circumcircle,
 * the arc midpoint P, the perpendicular foot M on the longer chord and the
 * broken line A-C-B are redrawn on every move.  The two checkboxes are the
 * applet's "names" (on by default) and "hint" (its proof with Q and F), and
 * Reset restores the applet's starting triangle.
 */

(function () {
  const Core = BrokenChordMrHommCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: circle, chords, proof lines and angle marks,
   * dots, names, then the handles that keep keyboard focus. */
  const back = board.layer("back");
  const chords = board.layer("chords");
  const proof = board.layer("proof");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circum = board.circle({ x: 200, y: 150 }, 90, "circum", back);
  const km = board.segment(state.A, state.A, "chord-main", chords);
  const mc = board.segment(state.A, state.A, "chord-broken", chords);
  const cl = board.segment(state.A, state.A, "chord-broken", chords);
  const pm = board.segment(state.A, state.A, "perp", chords);

  // Stuart Anderson's proof, as drawn by the applet when "hint" is on.
  const hintSegments = [
    board.segment(state.A, state.A, "hint-line", proof), // L-F
    board.segment(state.A, state.A, "hint-line", proof), // M-Q
    board.segment(state.A, state.A, "hint-line", proof), // Q-F
    board.segment(state.A, state.A, "hint-line", proof), // K-Q
    board.segment(state.A, state.A, "hint-draw", proof), // C-F
  ];
  const corners = [
    board.rightAngle(state.A, state.A, state.A, 10, "corner", marks),
    board.rightAngle(state.A, state.A, state.A, 10, "corner", marks),
  ];
  const angles = [
    board.angleArc(state.A, state.A, state.A, 16, "angle-two", marks), // KQL
    board.angleArc(state.A, state.A, state.A, 14, "angle-two", marks), // LCF
    board.angleArc(state.A, state.A, state.A, 12, "angle-one", marks), // KQC
    board.angleArc(state.A, state.A, state.A, 12, "angle-one", marks), // LCF
    board.angleArc(state.A, state.A, state.A, 12, "angle-one", marks), // FKL
  ];

  const dotM = board.point(state.A, "constructed", 4, dots);
  const dotP = board.point(state.A, "constructed", 4, dots);
  const dotQ = board.point(state.A, "constructed-hint", 4, dots);
  const dotF = board.point(state.A, "constructed-hint", 4, dots);

  const labelOffsets = {
    A: [-15, -10], B: [7, -10], C: [7, -10],
    P: [-15, 16], M: [7, 16], Q: [-15, -10], F: [7, 16],
  };
  const labels = {};
  for (const key of Object.keys(labelOffsets)) {
    labels[key] = board.label(state.A, key, "point-label",
      labelOffsets[key][0], labelOffsets[key][1], names);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
    describe: (p) => `x ${Math.round(p.x)}, y ${Math.round(p.y)} in the drawing.`,
  };
  const handles = {};
  for (const key of ["A", "B", "C"]) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Point ${key}. Drag it, or focus it and use the arrow keys to move the corner.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of ["A", "B", "C"]) handles[key].set(state[key]);

    if (!g) {
      for (const s of [circum, km, mc, cl, pm, ...hintSegments, ...corners, ...angles,
        dotM, dotP, dotQ, dotF]) s.show(false);
      for (const key of Object.keys(labels)) labels[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, options: state.options });
      return;
    }

    for (const s of [circum, km, mc, cl, pm, ...hintSegments, ...corners, ...angles,
      dotM, dotP]) s.show(true);

    circum.set(g.circle.c, g.circle.r);
    km.set(g.K, g.M);
    mc.set(g.M, g.C);
    cl.set(g.C, g.L);
    pm.set(g.P, g.M);

    const f = g.F || g.L; // the applet's F is NaN when BQ is parallel to AC
    hintSegments[0].set(g.L, f);
    hintSegments[1].set(g.M, g.Q);
    hintSegments[2].set(g.Q, f);
    hintSegments[3].set(g.K, g.Q);
    hintSegments[4].set(g.C, f);
    corners[0].set(g.M, g.K, g.P, 10);
    corners[1].set(g.M, g.P, g.C, 10);
    angles[0].set(g.Q, g.K, g.L, 16);
    angles[1].set(g.C, g.L, f, 14);
    angles[2].set(g.K, g.Q, g.C, 12);
    angles[3].set(g.L, g.C, f, 12);
    angles[4].set(f, g.K, g.L, 12);
    for (const s of [...hintSegments, ...corners, ...angles]) s.show(state.options.hint);
    for (const i of [0, 2, 4]) hintSegments[i].show(state.options.hint && !!g.F);
    for (const i of [1, 3, 4]) angles[i].show(state.options.hint && !!g.F);
    dotQ.set(g.Q);
    dotQ.show(state.options.hint);
    dotF.set(f);
    dotF.show(state.options.hint && !!g.F);
    dotM.set(g.M);
    dotP.set(g.P);

    const far = (p, q) => Core.dist(p, q) > 1;
    labels.A.set(g.A); labels.B.set(g.B); labels.C.set(g.C);
    labels.P.set(g.P); labels.M.set(g.M); labels.Q.set(g.Q); labels.F.set(g.F);
    for (const key of ["A", "B", "C"]) labels[key].show(state.options.names);
    labels.P.show(state.options.names && far(g.P, g.A) && far(g.P, g.B) && far(g.P, g.C));
    labels.M.show(state.options.names && far(g.M, g.A) && far(g.M, g.B) && far(g.M, g.C));
    labels.Q.show(state.options.names && state.options.hint);
    labels.F.show(state.options.names && state.options.hint && !!g.F);

    // This is a picture, not a game: exploring it counts as finished.
    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, P: g.P, M: g.M, K: g.K, L: g.L,
        Q: g.Q, F: g.F, circle: g.circle, lengths: g.lengths, options: state.options,
      });
    }
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    hintBox.checked = state.options.hint;
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
