"use strict";

/*
 * Browser UI for Expanded Incircle. All the geometry lives in the DOM-free
 * expanded-incircle-core.js; this file draws it and takes input.
 *
 * Drag A, B or C to reshape the triangle, or drag P along the side BC. The
 * six points P, Q, R, P', Q', R' are rebuilt from the applet's five rotations;
 * the amber circle through them keeps the incenter I as its centre. The five
 * checkboxes are the applet's "Show ..." options. The orange arcs show the
 * rotations, which become the edges of a constant-width curve when P is
 * pushed outside the triangle.
 */

(() => {
  const C = ExpandedIncircleCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const toggles = {
    names: document.getElementById("namesCheck"),
    rotations: document.getElementById("rotationsCheck"),
    circle: document.getElementById("circleCheck"),
    incircle: document.getElementById("incircleCheck"),
    gergonne: document.getElementById("gergonneCheck"),
  };

  const svg = document.getElementById("board");
  const board = Geom.board(svg);
  const fill = board.layer("fill");
  const arcsLayer = board.layer("arcs");
  const circles = board.layer("circles");
  const guides = board.layer("guides");
  const markers = board.layer("markers");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = C.start();
  const initialP = C.geometry(state).P;

  /** Write the status line; "win", "lose" and "done" are the record's signals. */
  function say(text, kind) {
    statusEl.textContent = text;
    for (const k of ["win", "lose", "done"]) statusEl.classList.remove(k);
    if (kind) statusEl.classList.add(kind);
  }

  /* Each SVG object is made once and then moved with .set(), so dragging and
     keyboard focus survive every redraw. */
  const triangle = board.polygon([state.A, state.B, state.C], "tri-fill", fill);
  const rotationArcs = Array.from({ length: 6 }, () => board.arc(state.A, 1, 0, 1, "rotation-arc", arcsLayer));
  const incircle = board.circle(state.A, 1, "incircle", circles);
  const sixCircle = board.circle(state.A, 1, "six-circle", circles);

  const chords = Array.from({ length: 3 }, () => board.segment(state.A, state.B, "chord", guides));
  const cevians = Array.from({ length: 3 }, () => board.segment(state.A, state.B, "cevian", guides));
  const spokes = Array.from({ length: 3 }, () => board.segment(state.A, state.B, "conway-spoke", guides));

  const touchDots = [0, 1, 2].map(() => board.point(state.A, "touch-dot", 4, markers));
  const iDot = board.point(state.A, "i-dot", 4.5, markers);
  const sixDots = [0, 1, 2, 3, 4, 5].map(() => board.point(state.A, "six-dot", 4.5, markers));

  const names = ["A", "B", "C", "D", "E", "F", "I", "P", "Q", "R", "Pp", "Qp", "Rp"];
  const shown = { A: "A", B: "B", C: "C", D: "D", E: "E", F: "F", I: "I",
    P: "P", Q: "Q", R: "R", Pp: "P'", Qp: "Q'", Rp: "R'" };
  const text = Object.fromEntries(names.map((n) => [n,
    board.label(state.A, shown[n], "pt-label", 7, -7, labels)]));
  const offsets = {
    A: [-15, -11], B: [-15, 18], C: [7, -11],
    D: [-4, 18], E: [7, -8], F: [-17, -8], I: [7, -8],
    P: [-4, 18], Q: [7, 16], R: [7, -8],
    Pp: [-4, 18], Qp: [7, 16], Rp: [7, -8],
  };

  function place(name, p, cls) {
    const label = text[name];
    label.show(Boolean(p));
    if (p) label.set(p, shown[name], offsets[name][0], offsets[name][1]);
    label.node.setAttribute("class", "pt-label" + (cls ? " " + cls : ""));
  }

  const clamp = (p) => C.clampToBoard(p);
  const describe = (p, name) =>
    name === "P"
      ? `at ${p.x.toFixed(0)}, ${p.y.toFixed(0)} on the side BC, parameter ${state.coefP.toFixed(2)}`
      : `at ${p.x.toFixed(0)}, ${p.y.toFixed(0)} in the drawing`;
  const onMove = (p, name) => {
    state = name === "P" ? C.moveP(state, p) : C.moveVertex(state, name, p);
    render();
  };
  const pOnSide = (p) => {
    const g = C.geometry(state);
    return g.valid ? C.foot(p, g.B, g.C) : p;
  };
  const handles = {
    A: board.handle("A", state.A, { r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: "Corner A. Drag it, or focus it and use the arrow keys to move it." }),
    B: board.handle("B", state.B, { r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: "Corner B. Drag it, or focus it and use the arrow keys to move it." }),
    C: board.handle("C", state.C, { r: 9, step: 5, layer: handlesLayer, clamp, describe, onMove,
      label: "Corner C. Drag it, or focus it and use the arrow keys to move it." }),
    P: board.handle("P", initialP, { r: 9, step: 5, layer: handlesLayer,
      clamp: pOnSide, describe, onMove,
      label: "Point P on side BC. Drag it, or focus it and use the arrow keys to slide it along the side." }),
  };

  /* The applet also lets the player drag the whole triangle by its inside. */
  let shapeDrag = null;
  svg.addEventListener("pointerdown", (e) => {
    if (!e.target.classList.contains("tri-fill")) return;
    shapeDrag = {
      at: board.toLocal(e.clientX, e.clientY),
      A: { ...state.A }, B: { ...state.B }, C: { ...state.C },
    };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!shapeDrag) return;
    const at = board.toLocal(e.clientX, e.clientY);
    const dx = at.x - shapeDrag.at.x, dy = at.y - shapeDrag.at.y;
    for (const name of ["A", "B", "C"]) {
      state = C.moveVertex(state, name, {
        x: shapeDrag[name].x + dx, y: shapeDrag[name].y + dy,
      });
    }
    render();
  });
  const endShapeDrag = () => { shapeDrag = null; };
  svg.addEventListener("pointerup", endShapeDrag);
  svg.addEventListener("pointercancel", endShapeDrag);

  function render() {
    const g = C.geometry(state);
    const o = state.options;
    triangle.show(g.valid);
    for (const shape of rotationArcs) shape.show(false);
    incircle.show(false);
    sixCircle.show(false);
    for (const shape of chords.concat(cevians, spokes)) shape.show(false);
    for (const dot of touchDots) dot.show(false);
    iDot.show(false);
    for (const dot of sixDots) dot.show(false);
    for (const name of names) text[name].show(false);

    for (const name of ["A", "B", "C"]) {
      handles[name].set(state[name]);
      if (o.names) place(name, state[name], "vertex-label");
    }

    if (!g.valid) {
      say("Move A, B and C so they form a triangle; the drawing cannot be made from a straight line.");
    } else {
      handles.P.set(g.P);
      triangle.set([g.A, g.B, g.C]);
      incircle.set(g.incircle.center, g.incircle.radius);
      sixCircle.set(g.circle.center, g.circle.radius);
      incircle.show(o.incircle);
      sixCircle.show(o.circle);

      if (o.rotations) {
        for (let i = 0; i < 6; i++) {
          const [centre, from, to, point] = g.arcs[i];
          const a0 = Math.atan2(point.y - centre.y, point.x - centre.x);
          rotationArcs[i].set(centre, C.dist(centre, point), a0, a0 + C.signedAngle(centre, from, to));
          rotationArcs[i].show(true);
        }
      }

      for (let i = 0; i < 3; i++) {
        const pair = [[g.P, g.Pp], [g.Q, g.Qp], [g.R, g.Rp]][i];
        chords[i].set(pair[0], pair[1]);
        chords[i].show(true);
      }
      const cevianPairs = [[g.A, g.D], [g.B, g.E], [g.C, g.F]];
      for (let i = 0; i < 3; i++) {
        cevians[i].set(cevianPairs[i][0], cevianPairs[i][1]);
        cevians[i].show(o.gergonne);
      }
      const spokePairs = [[g.incircle.center, g.D], [g.incircle.center, g.E], [g.incircle.center, g.F]];
      for (let i = 0; i < 3; i++) {
        spokes[i].set(spokePairs[i][0], spokePairs[i][1]);
        spokes[i].show(o.incircle);
      }

      [g.D, g.E, g.F].forEach((p, i) => { touchDots[i].set(p); touchDots[i].show(true); });
      iDot.set(g.I);
      iDot.show(o.incircle || o.circle);
      g.sixPoints.forEach((p, i) => { sixDots[i].set(p); sixDots[i].show(true); });

      if (o.names) {
        const points = { D: g.D, E: g.E, F: g.F, I: g.I,
          P: g.P, Q: g.Q, R: g.R, Pp: g.Pp, Qp: g.Qp, Rp: g.Rp };
        // As in ShowNames(), a label is hidden when its point lands on a
        // vertex or a touch point (within ten drawing units).
        for (const name in points) {
          const p = points[name];
          const near = [g.A, g.B, g.C, g.D, g.E, g.F].some((v) => C.dist(p, v) <= 10);
          place(name, near ? null : p);
        }
      }

      const spread = C.radiusSpread(g);
      say(`All six dots are ${g.circle.radius.toFixed(2)} units from I ` +
        `(difference ${spread.toExponential(1)}); CP = CR' = ${C.dist(g.C, g.P).toFixed(2)}.`);
    }

    // The position, for the player's record and the tutor (board units).
    if (window.Track) {
      window.Track.state({ A: state.A, B: state.B, C: state.C, coefP: state.coefP, options: state.options });
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
    render();
  });

  board.onTheme(render);
  render();
})();
