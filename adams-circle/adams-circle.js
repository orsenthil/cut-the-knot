"use strict";

/*
 * Browser UI for Adams' circle. The construction and the numbers live in
 * adams-circle-core.js; this file only draws them and takes input.
 *
 * Drag any of the three corner handles. The incircle, the contact triangle
 * DEF, the three lines through the Gergonne point G and the six points on the
 * sides are rebuilt from the new triangle; the amber circle through those six
 * points always turns out to have the incenter I as its centre. The six
 * checkboxes are the applet's own "Show ..." options; the hint draws the X, Y,
 * M, N construction from the page's proof.
 */

(() => {
  const C = AdamsCircleCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const toggles = {
    names: document.getElementById("namesCheck"),
    incircle: document.getElementById("incircleCheck"),
    gergonneLines: document.getElementById("gergonneLinesCheck"),
    gergonneTriangle: document.getElementById("gergonneTriangleCheck"),
    adamsCircle: document.getElementById("adamsCheck"),
    hint: document.getElementById("hintCheck"),
  };

  const board = Geom.board(document.getElementById("board"));
  const fill = board.layer("fill");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const markers = board.layer("markers");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  let state = C.start();

  /** Write the status line. "win", "lose" and "done" are the record's signals. */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  /* Every object is made once and then moved with .set(), so a handle keeps
     keyboard focus across a redraw. */
  const tri = board.polygon([state.A, state.B, state.C], "tri-fill", fill);
  const contact = board.polygon([state.A, state.B, state.C], "contact-tri", fill);
  const incircle = board.circle(state.A, 1, "incircle", circles);
  const adams = board.circle(state.A, 1, "adams-circle", circles);

  const sideLines = [
    board.line(state.A, state.B, "parallel-line", guides),
    board.line(state.A, state.B, "parallel-line", guides),
    board.line(state.A, state.B, "parallel-line", guides),
  ];
  const hintLines = [
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
    board.segment(state.A, state.B, "hint-line", guides),
  ];

  const contactDots = [board.point(state.A, "contact-dot", 3.6, markers),
    board.point(state.A, "contact-dot", 3.6, markers),
    board.point(state.A, "contact-dot", 3.6, markers)];
  const gDot = board.point(state.A, "g-dot", 4, markers);
  const iDot = board.point(state.A, "i-dot", 4.5, markers);
  const sixDots = ["P", "Q", "R", "S", "T", "U"].map((n) =>
    board.point(state.A, "six-dot", 4, markers));
  const hintDots = ["X", "Y", "M", "N"].map((n) =>
    board.point(state.A, "hint-dot", 3.4, markers));

  const named = ["A", "B", "C", "D", "E", "F", "G", "I", "P", "Q", "R", "S", "T", "U", "X", "Y", "M", "N"];
  const text = Object.fromEntries(named.map((n) => [n,
    board.label(state.A, n, "pt-label", 8, -8, labels)]));
  const offsets = {
    A: [-16, -12], B: [-16, 18], C: [-16, -12],
    D: [-4, 18], E: [8, -8], F: [-14, -10],
    G: [8, 16], I: [8, -8],
    P: [-4, 18], Q: [8, 16], R: [8, -8], S: [-16, -8], T: [-16, 18], U: [8, 16],
    X: [8, -8], Y: [8, -8], M: [8, 16], N: [-16, 16],
  };

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p, name) =>
    `at x ${Math.round(p.x)}, y ${Math.round(p.y)} in the drawing`;
  const onMove = (p, name) => {
    state = C.moveVertex(state, name, p);
    render();
  };
  const handlesById = {
    A: board.handle("A", state.A, { r: 9, step: 5, layer: handles, clamp, describe, onMove,
      label: "Vertex A. Drag it, or focus it and use the arrow keys to move it." }),
    B: board.handle("B", state.B, { r: 9, step: 5, layer: handles, clamp, describe, onMove,
      label: "Vertex B. Drag it, or focus it and use the arrow keys to move it." }),
    C: board.handle("C", state.C, { r: 9, step: 5, layer: handles, clamp, describe, onMove,
      label: "Vertex C. Drag it, or focus it and use the arrow keys to move it." }),
  };

  function place(name, p, cls) {
    const label = text[name];
    label.show(Boolean(p));
    if (p) label.set(p, name, offsets[name][0], offsets[name][1]);
    if (cls) label.node.setAttribute("class", "pt-label " + cls);
  }

  function render() {
    const g = C.geometry(state);
    const o = state.options;

    for (const name of ["A", "B", "C"]) {
      const h = handlesById[name];
      h.set(state[name]);
      text[name].show(o.names);
      place(name, o.names ? state[name] : null, "vertex-label");
    }
    text.I.show(false);
    for (const name of ["D", "E", "F", "G", "P", "Q", "R", "S", "T", "U", "X", "Y", "M", "N"]) {
      text[name].show(false);
    }
    tri.show(g.valid);
    contact.show(g.valid && o.gergonneTriangle);
    incircle.show(g.valid && o.incircle);
    adams.show(g.valid && o.adamsCircle);
    for (const s of sideLines) s.show(false);
    for (const s of hintLines) s.show(false);
    for (const d of contactDots) d.show(false);
    gDot.show(false);
    iDot.show(false);
    for (const d of sixDots) d.show(false);
    for (const d of hintDots) d.show(false);

    if (!g.valid) {
      say("Move A, B and C so they form a triangle; the drawing cannot be made from a straight line.");
    } else {
      tri.set([g.A, g.B, g.C]);
      contact.set([g.D, g.E, g.F]);
      incircle.set(g.I, g.radius);
      adams.set(g.circle.center, g.circle.radius);

      const parallels = [[g.G, g.ef], [g.G, g.fd], [g.G, g.de]];
      for (let i = 0; i < 3; i++) {
        sideLines[i].set(parallels[i][0], parallels[i][1]);
        sideLines[i].show(o.gergonneLines);
      }

      const hintSegments = [
        [g.X, g.Y], [g.X, g.D], [g.D, g.Y], [g.D, g.A],
        [g.P, g.M], [g.Q, g.N], [g.A, g.M], [g.A, g.N],
      ];
      for (let i = 0; i < hintSegments.length; i++) {
        hintLines[i].set(hintSegments[i][0], hintSegments[i][1]);
        hintLines[i].show(o.hint);
      }

      const dots = [g.D, g.E, g.F];
      for (let i = 0; i < 3; i++) {
        contactDots[i].set(dots[i]);
        contactDots[i].show(o.gergonneTriangle);
      }
      gDot.set(g.G);
      gDot.show(o.gergonneLines);
      iDot.set(g.I);
      iDot.show(o.incircle || o.adamsCircle);

      for (let i = 0; i < 6; i++) sixDots[i].set(g.sixPoints[i]);
      for (let i = 0; i < 4; i++) {
        const p = [g.X, g.Y, g.M, g.N][i];
        hintDots[i].set(p);
        hintDots[i].show(o.hint);
      }

      if (o.names) {
        const namedPoints = { D: g.D, E: g.E, F: g.F, G: g.G, I: g.I,
          P: g.P, Q: g.Q, R: g.R, S: g.S, T: g.T, U: g.U };
        const hidden = new Set();
        if (!o.gergonneTriangle) for (const n of ["D", "E", "F"]) hidden.add(n);
        if (!o.gergonneLines) for (const n of ["G", "P", "Q", "R", "S", "T", "U"]) hidden.add(n);
        if (!o.incircle && !o.adamsCircle) hidden.add("I");
        for (const n in namedPoints) if (!hidden.has(n)) place(n, namedPoints[n]);
        if (o.hint) {
          const hintPoints = { X: g.X, Y: g.Y, M: g.M, N: g.N };
          for (const n in hintPoints) place(n, hintPoints[n]);
        }
      }

      const spread = C.circleError(g);
      say(`All six marked points are ${g.circle.radius.toFixed(1)} drawing units from I ` +
        `(largest difference ${spread.toExponential(1)}). Drag a corner and they stay on the circle.`);
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
    state = C.randomStart();
    for (const name in toggles) toggles[name].checked = state.options[name];
    render();
  });

  board.onTheme(render);
  render();
})();
