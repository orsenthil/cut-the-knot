"use strict";

/*
 * The page for Altitude Mirror: drawing and input only; all the geometry is
 * in altitude-mirror-core.js. A 360 by 240 SVG board holds the triangle ABC,
 * its altitude AH, the point P sliding along that altitude, and the two lines
 * HD and HE cut out by BP and CP. Drag A, B, C or P with a pointer, or focus a
 * handle and move it with the arrow keys (Shift for a bigger step). The three
 * checkboxes are the applet's "Show names", "statement" and "hint".
 */

(function () {
  const Core = AltitudeMirrorCore;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const statementBox = document.getElementById("statementBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const angleLayer = board.layer("angles");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are how the player's record learns that a play has
   * ended. This is an illustration, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* All the objects are made once and only their attributes change, so a
     focused handle keeps its focus across a redraw. */
  const edgeAB = board.segment(state.A, state.B, "tri-edge", shapes);
  const edgeBC = board.segment(state.B, state.C, "tri-edge", shapes);
  const edgeCA = board.segment(state.C, state.A, "tri-edge", shapes);
  const altitude = board.line(state.A, state.H || state.A, "altitude", shapes);
  const cevianBD = board.line(state.B, state.D || state.B, "cevian", shapes);
  const cevianCE = board.line(state.C, state.E || state.C, "cevian", shapes);
  const rayHD = board.segment(state.H || state.A, state.D || state.A, "mirror-ray", shapes);
  const rayHE = board.segment(state.H || state.A, state.E || state.A, "mirror-ray", shapes);
  const parallel = board.line(state.A, state.A, "helper", guides);
  const rightBH = board.rightAngle(state.A, state.B, state.C, 10, "right-angle", guides);
  const rightCH = board.rightAngle(state.A, state.C, state.B, 10, "right-angle", guides);
  const arcCHD = board.angleArc(state.A, state.C, state.D || state.A, 22, "angle-arc", angleLayer);
  const arcBHE = board.angleArc(state.A, state.B, state.E || state.A, 30, "angle-arc", angleLayer);

  const dotH = board.point(state.A, "aux-dot", 3.5, dots);
  const dotD = board.point(state.A, "aux-dot", 3, dots);
  const dotE = board.point(state.A, "aux-dot", 3, dots);
  const dotF = board.point(state.A, "hint-dot", 3, dots);
  const dotG = board.point(state.A, "hint-dot", 3, dots);

  const text = {};
  for (const name of ["A", "B", "C", "H", "P", "E", "D", "F", "G"]) {
    text[name] = board.label(state.A, name, "point-label", 7, -7, labels);
  }

  const clamp = (name) => (q) => Core.clampPoint(state, name, q);
  const onMove = (name) => (p) => {
    state = Core.move(state, name, p);
    render();
  };
  const vertex = ["A", "B", "C", "P"];
  const handles = {};
  for (const name of vertex) {
    handles[name] = board.handle(name, state[name], {
      r: name === "P" ? 7 : 8,
      step: 2,
      shift: 10,
      cls: name === "P" ? "geom-handle point-handle" : "geom-handle vertex-handle",
      label: "Point " + name + (name === "P" ? " on the altitude" : " of the triangle") +
        ". Drag it, or focus it and use the arrow keys.",
      clamp: clamp(name),
      onMove: onMove(name),
      layer: handlesLayer,
    });
  }

  function render() {
    const f = Core.compute(state);
    const { A, B, C, P, H, D, E, F, G } = f;

    edgeAB.set(A, B);
    edgeBC.set(B, C);
    edgeCA.set(C, A);
    altitude.set(A, H);
    cevianBD.set(B, D || B);
    cevianCE.set(C, E || C);
    rayHD.set(H, D || H);
    rayHE.set(H, E || H);

    parallel.set(A, f.Q);
    rightBH.set(H, A, B, 10);
    rightCH.set(H, A, C, 10);
    arcCHD.set(H, C, D || H, 22);
    arcBHE.set(H, B, E || H, 32);

    dotH.set(H);
    dotD.show(!!D).set(D || H);
    dotE.show(!!E).set(E || H);
    dotF.show(state.showHint && !!F).set(F || H);
    dotG.show(state.showHint && !!G).set(G || H);

    const at = {
      A: [A, -12, -10], B: [B, -14, 17], C: [C, 7, 17],
      H: [H, 6, 17], P: [P, 9, -8],
      E: [E || H, 7, -8], D: [D || H, -16, -8],
      F: [F || H, 6, -9], G: [G || H, 6, -9],
    };
    for (const name in at) {
      const [p, dx, dy] = at[name];
      const used = name === "F" || name === "G" ? state.showHint : true;
      text[name].show(state.showNames && used).set(p, name, dx, dy);
    }

    for (const name of vertex) handles[name].set(state[name]);
    parallel.show(state.showHint);
    rightBH.show(state.showHint);
    rightCH.show(state.showHint);
    arcCHD.show(state.showStatement);
    arcBHE.show(state.showStatement);

    namesBox.checked = state.showNames;
    statementBox.checked = state.showStatement;
    hintBox.checked = state.showHint;

    say(Core.describe(f));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const [box, key] of [[namesBox, "showNames"], [statementBox, "showStatement"], [hintBox, "showHint"]]) {
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
