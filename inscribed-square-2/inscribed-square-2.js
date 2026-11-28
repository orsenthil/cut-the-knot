"use strict";

/*
 * The page for Inscribed Square 2: drawing and input only; all the geometry is
 * in inscribed-square-2-core.js. A 360 by 240 SVG board holds the triangle ABC
 * and the Vecten square on AB. The lines from C through the far corners of that
 * square mark P and Q on AB; the red square through P and Q is the answer.
 * Drag A, B or C with a pointer, or focus a handle and use the arrow keys
 * (Shift for a bigger step). The two checkboxes are the applet's "Show names"
 * and "Extra info"; Reset returns to the opening triangle.
 */

(function () {
  const Core = InscribedSquare2Core;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const squareLayer = board.layer("square");
  const hintLayer = board.layer("hints");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

  /**
   * Shows a line under the diagram. This is an illustration: no kind is ever
   * passed, so the player's record sees an explored demo and not a win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* All the SVG objects are created once and only their attributes change, so
     a focused handle keeps its focus when the triangle is redrawn. */
  const vecten = board.polygon([state.A, state.B, state.C], "vecten-square", shapes);
  const edgeAB = board.segment(state.A, state.B, "tri-edge", shapes);
  const edgeBC = board.segment(state.B, state.C, "tri-edge", shapes);
  const edgeCA = board.segment(state.C, state.A, "tri-edge", shapes);
  const cevianCP = board.line(state.A, state.B, "cevian", shapes);
  const cevianCQ = board.line(state.A, state.B, "cevian", shapes);
  const legAP = board.segment(state.A, state.A, "leg", shapes);
  const legBQ = board.segment(state.B, state.B, "leg", shapes);
  const answer = board.polygon([state.A, state.A, state.A], "inscribed-square", squareLayer);
  const cornerP = board.rightAngle(state.A, state.B, state.C, 9, "square-corner", guides);
  const cornerQ = board.rightAngle(state.A, state.B, state.C, 9, "square-corner", guides);

  const hintLines = [];
  for (let i = 0; i < 7; i++) hintLines.push(board.line(state.A, state.B, "hint-line", hintLayer));
  const dotP = board.point(state.A, "aux-dot", 3.5, dots);
  const dotQ = board.point(state.A, "aux-dot", 3.5, dots);
  const dotPP = board.point(state.A, "aux-dot", 3.5, dots);
  const dotQQ = board.point(state.A, "aux-dot", 3.5, dots);
  const dotC1 = board.point(state.A, "centre-dot", 4.5, dots);
  const dotC2 = board.point(state.A, "centre-dot", 4.5, dots);

  const labelsAt = {};
  for (const name of ["A", "B", "C", "Ca", "Cb", "P", "Q", "P'", "Q'"]) {
    labelsAt[name] = board.label(state.A, name, "point-label", 7, -7, labels);
  }
  const offsets = {
    A: [-15, 18], B: [6, 18], C: [-4, -10],
    Ca: [-18, 16], Cb: [6, 16],
    P: [-14, 18], Q: [6, 18], "P'": [-20, -6], "Q'": [6, -6],
  };

  /* An applet intersection can be NaN when two lines are parallel. Keep the
     SVG attributes numeric in that case and say why the picture is missing. */
  const safe = (q) => (q && Number.isFinite(q.x) && Number.isFinite(q.y)) ? q : state.A;
  const on = (q) => !!q && Number.isFinite(q.x) && Number.isFinite(q.y);

  const clamp = () => (q) => Core.clampPoint(state, "A", q);
  const onMove = (name) => (q) => {
    state = Core.move(state, name, q);
    render();
  };
  const handles = {};
  for (const name of ["A", "B", "C"]) {
    handles[name] = board.handle(name, state[name], {
      r: 9,
      step: 2,
      shift: 10,
      cls: "geom-handle vertex-handle",
      label: `Point ${name} of the triangle. Drag it, or focus it and use the arrow keys.`,
      clamp: clamp(),
      onMove: onMove(name),
      layer: handlesLayer,
    });
  }

  function render() {
    const f = Core.compute(state);
    const m = Core.metrics(f);
    const { A, B, C, CA, CB, P, Q, PP, QQ, c1, c2 } = f;

    vecten.set([safe(A), safe(CA), safe(CB), safe(B)]);
    edgeAB.set(A, B);
    edgeBC.set(B, C);
    edgeCA.set(C, A);
    cevianCP.set(C, CA);
    cevianCQ.set(C, CB);
    legAP.set(A, PP);
    legBQ.set(B, QQ);
    answer.set([safe(P), safe(PP), safe(QQ), safe(Q)]);
    cornerP.set(safe(P), safe(PP), safe(Q), 9);
    cornerQ.set(safe(Q), safe(QQ), safe(P), 9);

    const guidePairs = [
      [A, CB], [B, CA], [P, QQ], [Q, PP], [C, c1], [C, c2], [c1, c2],
    ];
    hintLines.forEach((line, i) => {
      const [u, v] = guidePairs[i];
      line.set(safe(u), safe(v));
      line.show(state.showHint && on(u) && on(v));
    });

    const dotsAt = {
      P: [dotP, P], Q: [dotQ, Q], "P'": [dotPP, PP], "Q'": [dotQQ, QQ],
      c1: [dotC1, c1], c2: [dotC2, c2],
    };
    for (const name in dotsAt) {
      const [dot, q] = dotsAt[name];
      dot.set(safe(q));
      dot.show(on(q) && (name === "c1" || name === "c2" ? state.showHint : true));
    }
    cornerP.show(m.valid);
    cornerQ.show(m.valid);

    const points = { A, B, C, Ca: CA, Cb: CB, P, Q, "P'": PP, "Q'": QQ };
    for (const name in offsets) {
      const [dx, dy] = offsets[name];
      labelsAt[name].set(safe(points[name]), name, dx, dy);
      labelsAt[name].show(state.showNames && on(points[name]));
    }

    for (const name of ["A", "B", "C"]) handles[name].set(state[name]);
    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;

    say(Core.describe(f, m));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const [box, key] of [[namesBox, "showNames"], [hintBox, "showHint"]]) {
    box.addEventListener("change", () => {
      state = Core.option(state, key, box.checked);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
