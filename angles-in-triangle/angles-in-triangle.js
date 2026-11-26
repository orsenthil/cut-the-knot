"use strict";

/*
 * The page for Angles in a Triangle: drawing and input only. The geometry is
 * in angles-in-triangle-core.js. The stage holds a triangle, the copy of it
 * translated to the draggable centre P, and the three fold lines that carry
 * the corners onto the foot D of the altitude. The exercise preset adds the
 * interior point D of the 120-degree triangle and its angle of 60 degrees.
 */

(function () {
  const Core = AnglesInTriangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const foldingBtn = document.getElementById("foldingBtn");
  const exerciseBtn = document.getElementById("exerciseBtn");
  const resetBtn = document.getElementById("resetBtn");
  const namesBox = document.getElementById("namesBox");

  let state = Core.start({});

  /** The line under the drawing. An illustration has no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are made in paint order: guides under the triangles, arcs over
     them, labels over the arcs, and the focusable handles on top. */
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const arcs = board.layer("arcs");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const altitude = board.segment(state.A, state.B, "altitude", guides);
  const foldBase = board.segment(state.A, state.B, "fold-base", guides);
  const foldLeft = board.segment(state.A, state.B, "fold-leg", guides);
  const foldRight = board.segment(state.A, state.B, "fold-leg", guides);
  const triangle = board.polygon([state.A, state.B, state.C], "tri", shapes);
  const translated = board.polygon([state.A, state.B, state.C], "copy", shapes);

  const arcK = board.angleArc(state.A, state.B, state.C, 13, "arc-k", arcs);
  const arcL = board.angleArc(state.B, state.A, state.C, 11, "arc-l", arcs);
  const arcM = board.angleArc(state.C, state.A, state.B, 11, "arc-m", arcs);
  const foldK = board.angleArc(state.A, state.B, state.C, 16, "fold-k", arcs);
  const foldL = board.angleArc(state.A, state.B, state.C, 22, "fold-l", arcs);
  const foldM = board.angleArc(state.A, state.B, state.C, 28, "fold-m", arcs);

  const footDot = board.point(state.A, "foot", 4, shapes);
  const legs = [
    board.segment(state.A, state.B, "ex-leg", guides),
    board.segment(state.A, state.B, "ex-leg", guides),
    board.segment(state.A, state.B, "ex-leg", guides),
  ];
  const exArc = board.angleArc(state.A, state.B, state.C, 24, "ex-arc", arcs);
  const exLabel = board.label(state.A, "", "ex-value", 0, 0, text);
  const bdLabel = board.label(state.A, "", "ex-length", 0, 0, text);
  const cdLabel = board.label(state.A, "", "ex-length", 0, 0, text);

  const nameA = board.label(state.A, "A", "pt-label", 10, -9, text);
  const nameB = board.label(state.B, "B", "pt-label", -18, -8, text);
  const nameC = board.label(state.C, "C", "pt-label", -18, 16, text);
  const nameP = board.label(state.P, "P", "pt-label", 9, -9, text);
  const optional = {
    D: board.label(state.A, "D", "pt-label", -18, 18, text),
    E: board.label(state.A, "E", "pt-label", 6, -9, text),
    F: board.label(state.A, "F", "pt-label", 6, 16, text),
    G: board.label(state.A, "G", "pt-label", -18, -9, text),
    H: board.label(state.A, "H", "pt-label", -18, 16, text),
  };
  const centerDot = board.point(state.P, "centre", 3, shapes);

  const inside = (p) => ({
    x: Geom.clamp(p.x, 12, Core.WIDTH - 12),
    y: Geom.clamp(p.y, 12, Core.HEIGHT - 12),
  });
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`;

  const handles = {
    A: board.handle("A", state.A, {
      r: 11, step: 4, cls: "geom-handle", layer: tops, clamp: inside, describe,
      label: "Point A. Drag it, or focus it and use the arrow keys to move the triangle.",
      onMove: (p) => { state = Core.movePoint(state, "A", p); render(); },
    }),
    B: board.handle("B", state.B, {
      r: 11, step: 4, cls: "geom-handle", layer: tops, clamp: inside, describe,
      label: "Point B. Drag it, or focus it and use the arrow keys to move the triangle.",
      onMove: (p) => { state = Core.movePoint(state, "B", p); render(); },
    }),
    C: board.handle("C", state.C, {
      r: 11, step: 4, cls: "geom-handle", layer: tops, clamp: inside, describe,
      label: "Point C. Drag it, or focus it and use the arrow keys to move the triangle.",
      onMove: (p) => { state = Core.movePoint(state, "C", p); render(); },
    }),
    P: board.handle("P", state.P, {
      r: 11, step: 4, cls: "geom-handle centre-handle", layer: tops, clamp: inside, describe,
      label: "Point P, centre of the copied triangle. Drag it, or focus it and use the arrow keys.",
      onMove: (p) => { state = Core.movePoint(state, "P", p); render(); },
    }),
    D: board.handle("D", state.exercisePoint || state.A, {
      r: 11, step: 4, cls: "geom-handle ex-handle", layer: tops, clamp: inside, describe,
      label: "Point D of the exercise. Drag it, or focus it and use the arrow keys to change BD and CD.",
      onMove: (p) => { state = Core.movePoint(state, "D", p); render(); },
    }),
  };

  function render() {
    const g = Core.compute(state);
    const f = g.fold;

    triangle.set([state.A, state.B, state.C]);
    translated.set([g.copy.A, g.copy.B, g.copy.C]);
    centerDot.set(g.centroid);

    altitude.show(!!f);
    foldBase.show(!!f);
    foldLeft.show(!!f);
    foldRight.show(!!f);
    footDot.show(!!f);
    if (f) {
      altitude.set(f.K, f.D);
      foldBase.set(f.E, f.F);
      foldLeft.set(f.E, f.G);
      foldRight.set(f.F, f.H);
      footDot.set(f.D, 4);
      arcK.set(f.K, f.L, f.M, 13);
      arcL.set(f.L, f.K, f.M, 11);
      arcM.set(f.M, f.K, f.L, 11);
      foldK.set(f.D, f.E, f.F, 16);
      foldL.set(f.D, f.G, f.E, 22);
      foldM.set(f.D, f.F, f.H, 28);
    }
    for (const node of [arcK, arcL, arcM, foldK, foldL, foldM]) node.show(!!f);

    nameA.set(state.A, "A");
    nameB.set(state.B, "B");
    nameC.set(state.C, "C");
    nameP.set(state.P, "P");
    optional.D.set(state.exercisePoint || state.A, "D");
    if (f) {
      optional.E.set(f.E, "E");
      optional.F.set(f.F, "F");
      optional.G.set(f.G, "G");
      optional.H.set(f.H, "H");
    }
    const showExtra = state.showNames && !!f;
    for (const key of ["D", "E", "F", "G", "H"]) optional[key].show(showExtra);

    const ex = g.exercise;
    for (const leg of legs) leg.show(!!ex);
    exArc.show(!!ex);
    exLabel.show(!!ex);
    bdLabel.show(!!ex);
    cdLabel.show(!!ex);
    if (ex) {
      legs[0].set(ex.point, state.A);
      legs[1].set(ex.point, state.B);
      legs[2].set(ex.point, state.C);
      exArc.set(ex.point, state.A, state.C, 24);
      exLabel.set({ x: ex.point.x + 16, y: ex.point.y - 18 },
        `${Math.round(Core.degrees(ex.ADC))}\u00b0`);
      bdLabel.set(Core.midpoint(ex.point, state.B),
        Core.lengthText(ex.lengths.BD), -12, -6);
      cdLabel.set(Core.midpoint(ex.point, state.C),
        Core.lengthText(ex.lengths.CD), 4, -6);
    }

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    handles.P.set(state.P);
    handles.D.show(!!ex);
    if (ex) handles.D.set(ex.point);

    foldingBtn.setAttribute("aria-pressed", String(state.preset === "folding"));
    exerciseBtn.setAttribute("aria-pressed", String(state.preset === "exercise"));
    namesBox.checked = state.showNames;

    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  foldingBtn.addEventListener("click", () => { state = Core.start({ showNames: state.showNames }); render(); });
  exerciseBtn.addEventListener("click", () => { state = Core.exercisePreset({ showNames: state.showNames }); render(); });
  resetBtn.addEventListener("click", () => {
    state = state.preset === "exercise"
      ? Core.exercisePreset({ showNames: state.showNames })
      : Core.start({ showNames: state.showNames });
    render();
  });
  namesBox.addEventListener("change", () => { state = Core.setShowNames(state, namesBox.checked); render(); });

  board.onTheme(render);
  render();
})();
