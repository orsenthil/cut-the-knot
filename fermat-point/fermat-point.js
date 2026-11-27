"use strict";

/*
 * FermatPoint — the picture and the input for FermatPointCore.
 *
 * Four blue handles: A, B and C are the triangle's corners, and D starts at
 * the centroid but, as in the applet, can be dragged on its own.  The cores'
 * geometry drives every redraw: the three outward equilateral triangles, the
 * pink spokes through D, the three long lines AA', BB' and CC' and the Fermat
 * point F.  The checkboxes reproduce the applet's "names", "hint" and
 * "Fermat point" options; Reset restores its starting triangle.
 */

(function () {
  const Core = FermatPointCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nameBox = document.getElementById("names");
  const hintBox = document.getElementById("hint");
  const fermatBox = document.getElementById("fermat");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});
  const g0 = Core.geometry(state);

  const back = board.layer("back");
  const spokes = board.layer("spokes");
  const proofs = board.layer("proofs");
  const longLines = board.layer("long-lines");
  const marks = board.layer("marks");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const triangle = board.polygon([g0.A, g0.B, g0.C], "triangle", back);
  const spoke = [
    board.segment(g0.A, g0.D, "spoke", spokes),
    board.segment(g0.B, g0.D, "spoke", spokes),
    board.segment(g0.C, g0.D, "spoke", spokes),
    board.segment(g0.D, g0.Da, "spoke-out", spokes),
    board.segment(g0.D, g0.Db, "spoke-out", spokes),
    board.segment(g0.D, g0.Dc, "spoke-out", spokes),
  ];
  const proof = [
    board.polygon([g0.A, g0.Db, g0.Bp], "proof", proofs),
    board.polygon([g0.B, g0.Dc, g0.Cp], "proof", proofs),
    board.polygon([g0.C, g0.Da, g0.Ap], "proof", proofs),
  ];
  const long = [
    board.segment(g0.A, g0.Ap, "long", longLines),
    board.segment(g0.B, g0.Bp, "long", longLines),
    board.segment(g0.C, g0.Cp, "long", longLines),
  ];
  // The applet's Hint marks three groups of equal lengths and three 60° arcs.
  const hintSegs = [
    board.segment(g0.A, g0.D, "hint-a", marks),
    board.segment(g0.A, g0.Db, "hint-a", marks),
    board.segment(g0.Cp, g0.Dc, "hint-a", marks),
    board.segment(g0.B, g0.D, "hint-b", marks),
    board.segment(g0.B, g0.Dc, "hint-b", marks),
    board.segment(g0.Ap, g0.Da, "hint-b", marks),
    board.segment(g0.C, g0.D, "hint-c", marks),
    board.segment(g0.C, g0.Da, "hint-c", marks),
    board.segment(g0.Bp, g0.Db, "hint-c", marks),
  ];
  const hintArcs = [
    board.angleArc(g0.D, g0.A, g0.Db, 17, "hint-arc", marks),
    board.angleArc(g0.D, g0.B, g0.Dc, 20, "hint-arc", marks),
    board.angleArc(g0.D, g0.C, g0.Da, 23, "hint-arc", marks),
  ];
  const outerDots = [
    board.point(g0.Ap, "outer-dot", 4, dots),
    board.point(g0.Bp, "outer-dot", 4, dots),
    board.point(g0.Cp, "outer-dot", 4, dots),
  ];
  const turnDots = [
    board.point(g0.Da, "turn-dot", 4, dots),
    board.point(g0.Db, "turn-dot", 4, dots),
    board.point(g0.Dc, "turn-dot", 4, dots),
  ];
  const fDot = board.point(g0.F, "fermat-dot", 6, dots);

  const labelNames = ["A", "B", "C", "Ap", "Bp", "Cp", "D", "Da", "Db", "Dc"];
  const labels = {};
  for (const key of labelNames) {
    const offset = key.length > 1 ? [7, -8] : [-14, -10];
    labels[key] = board.label(g0.A, key, "point-label", offset[0], offset[1], names);
  }

  const shared = {
    step: 5, shift: 15, r: 8, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {
    A: board.handle("A", state.A, Object.assign({}, shared, {
      label: "Corner A. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    })),
    B: board.handle("B", state.B, Object.assign({}, shared, {
      label: "Corner B. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    })),
    C: board.handle("C", state.C, Object.assign({}, shared, {
      label: "Corner C. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    })),
    D: board.handle("D", state.D, Object.assign({}, shared, {
      cls: "geom-handle drag-d", r: 7,
      label: "Point D. Drag it toward F, or focus it and use the arrow keys.",
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    })),
  };

  /** The line under the picture.  "done" tells the player's record that the
   *  exploration has finished; there is no win or loss in an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const show = state.options;
    const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);

    triangle.set([g.A, g.B, g.C]);
    spoke[0].set(g.A, g.D); spoke[1].set(g.B, g.D); spoke[2].set(g.C, g.D);
    spoke[3].set(g.D, g.Da); spoke[4].set(g.D, g.Db); spoke[5].set(g.D, g.Dc);
    proof[0].set([g.A, g.Db, g.Bp]);
    proof[1].set([g.B, g.Dc, g.Cp]);
    proof[2].set([g.C, g.Da, g.Ap]);
    for (let i = 0; i < 3; i++) {
      long[i].set(g.lines[i].from, g.lines[i].to);
      long[i].show(!g.moreThan120);
      outerDots[i].set([g.Ap, g.Bp, g.Cp][i]);
      turnDots[i].set([g.Da, g.Db, g.Dc][i]);
    }
    const hintOn = show.hint && !g.moreThan120;
    hintSegs[0].set(g.A, g.D); hintSegs[1].set(g.A, g.Db); hintSegs[2].set(g.Cp, g.Dc);
    hintSegs[3].set(g.B, g.D); hintSegs[4].set(g.B, g.Dc); hintSegs[5].set(g.Ap, g.Da);
    hintSegs[6].set(g.C, g.D); hintSegs[7].set(g.C, g.Da); hintSegs[8].set(g.Bp, g.Db);
    hintArcs[0].set(g.D, g.A, g.Db, 17);
    hintArcs[1].set(g.D, g.B, g.Dc, 20);
    hintArcs[2].set(g.D, g.C, g.Da, 23);
    for (const s of hintSegs) s.show(hintOn);
    for (const a of hintArcs) a.show(hintOn);

    for (const h of ["A", "B", "C", "D"]) handles[h].set(state[h]);

    const dotText = g.nearD ? "F" : "D";
    const positions = {
      A: g.A, B: g.B, C: g.C, D: g.D,
      Ap: g.Ap, Bp: g.Bp, Cp: g.Cp,
      Da: g.Da, Db: g.Db, Dc: g.Dc,
    };
    const words = {
      A: "A", B: "B", C: "C", Ap: "A'", Bp: "B'", Cp: "C'",
      D: dotText, Da: dotText + "ₐ", Db: dotText + "ᵦ", Dc: dotText + "𝚌",
    };
    for (const key of labelNames) {
      const here = positions[key];
      labels[key].show(show.names && finite(here)
        && (["A", "B", "C", "D"].includes(key) || !g.moreThan120));
      if (finite(here)) labels[key].set(here, words[key]);
    }
    fDot.show(finite(g.F) && show.fermat);
    if (finite(g.F)) fDot.set(g.F);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D,
        F: finite(g.F) ? g.F : null,
        Ap: g.Ap, Bp: g.Bp, Cp: g.Cp,
        moreThan120: g.moreThan120, nearD: g.nearD,
        options: state.options,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", nameBox);
  toggle("hint", hintBox);
  toggle("fermat", fermatBox);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours come from CSS classes, so a theme flip needs no new geometry;
  // redraw anyway to keep the shared helper's hook.
  board.onTheme(render);
  render();
})();
