"use strict";

/*
 * The page for Escher's theorem: drawing and input only. The geometry is in
 * eschers-theorem-core.js. The stage holds a fixed equilateral triangle A'B'C'
 * and three handles A, B, C; moving one rebuilds the other two with 120-degree
 * rotations. The five checkboxes are the five "Show ..." boxes of the applet.
 */

(function () {
  const Core = EschersTheoremCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const checkboxes = {
    names: document.getElementById("namesBox"),
    angles: document.getElementById("anglesBox"),
    concurrency: document.getElementById("concurrencyBox"),
    tessellation: document.getElementById("tessBox"),
    hint: document.getElementById("hintBox"),
  };

  let state = Core.start({});

  /** The line under the game. An illustration has no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are made in paint order: copies first, handles and labels last. */
  const copiesLayer = board.layer("copies");
  const guidesLayer = board.layer("guides");
  const spokesLayer = board.layer("spokes");
  const hintLayer = board.layer("hint");
  const ceviansLayer = board.layer("cevians");
  const anglesLayer = board.layer("angles");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  // The applet's Recreate() always builds 138 hexagons; reuse their nodes.
  const cellNodes = [];
  for (let i = 0; i < 138; i++) {
    cellNodes.push(board.el("polygon", null, "tess-cell tess-" + (i % 6), copiesLayer));
  }

  const fixedTriangle = board.polygon([state.Aq, state.Bq, state.Cq], "fixed-tri", guidesLayer);
  const movingTriangle = board.polygon([state.A, state.B, state.C], "move-tri", guidesLayer);

  // Six spokes: every moving vertex joined to the two fixed centres.
  const spokePairs = [
    ["A", "Bq"], ["A", "Cq"], ["B", "Cq"], ["B", "Aq"], ["C", "Aq"], ["C", "Bq"],
  ];
  const spokes = spokePairs.map((pair) => board.segment(state[pair[0]], state[pair[1]], "spoke", spokesLayer));

  // Hint: the six edges from A, B, C to the Napoleon apices A'', B'', C''.
  const hintPairs = [
    ["A", "Bp"], ["A", "Cp"], ["B", "Cp"], ["B", "Ap"], ["C", "Ap"], ["C", "Bp"],
  ];
  const hintLines = hintPairs.map((pair) => board.segment(state[pair[0]], state[pair[1]], "hint-line", hintLayer));
  const apexDots = ["Ap", "Bp", "Cp"].map((key) => board.point(state[key], "apex-dot", 5, dotsLayer));

  const cevians = ["Aq", "Bq", "Cq"].map((key) => {
    const vertex = { Aq: "A", Bq: "B", Cq: "C" }[key];
    return board.segment(state[vertex], state[key], "cevian", ceviansLayer);
  });
  const centrePoint = board.point(state.F, "f-dot", 6, dotsLayer);

  const angleMarks = [
    board.angleArc(state.Aq, state.Bq, state.Cq, 21, "angle-mark", anglesLayer),
    board.angleArc(state.Bq, state.Cq, state.Aq, 21, "angle-mark", anglesLayer),
    board.angleArc(state.Cq, state.Aq, state.Bq, 21, "angle-mark", anglesLayer),
  ];
  const fixedDots = ["Aq", "Bq", "Cq"].map((key) => board.point(state[key], "q-dot", 5, dotsLayer));

  const nameKeys = ["A", "B", "C", "Aq", "Bq", "Cq", "Ap", "Bp", "Cp"];
  const names = [
    ["A", "A", 11, -11], ["B", "B", 11, -11], ["C", "C", 11, -11],
    ["Aq", "A\u2032", -19, 22], ["Bq", "B\u2032", 8, -13], ["Cq", "C\u2032", -24, -13],
    ["Ap", "A\u2033", 8, 17], ["Bp", "B\u2033", 8, -11], ["Cp", "C\u2033", -25, -11],
  ].map((entry) => board.label(state[entry[0]], entry[1], entry[0].endsWith("q")
    ? "pt-label q-label" : "pt-label", entry[2], entry[3], labelsLayer));

  const moved = (key) => (p) => {
    state = Core.adjust(state, key, p);
    render();
  };
  const handles = {
    A: board.handle("A", state.A, {
      r: 13, step: 3, layer: handlesLayer,
      label: "Point A. Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
      clamp: (p) => Core.clampToBoard(p), onMove: moved("A"),
    }),
    B: board.handle("B", state.B, {
      r: 13, step: 3, layer: handlesLayer,
      label: "Point B. Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
      clamp: (p) => Core.clampToBoard(p), onMove: moved("B"),
    }),
    C: board.handle("C", state.C, {
      r: 13, step: 3, layer: handlesLayer,
      label: "Point C. Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
      clamp: (p) => Core.clampToBoard(p), onMove: moved("C"),
    }),
  };

  function render() {
    const o = state.options;

    fixedTriangle.set([state.Aq, state.Bq, state.Cq]);
    movingTriangle.set([state.A, state.B, state.C]);
    spokePairs.forEach((pair, i) => spokes[i].set(state[pair[0]], state[pair[1]]));

    hintPairs.forEach((pair, i) => {
      hintLines[i].set(state[pair[0]], state[pair[1]]).show(o.hint);
    });
    ["Ap", "Bp", "Cp"].forEach((key, i) => {
      apexDots[i].set(state[key]).show(o.hint);
    });

    cevians.forEach((shape, i) => {
      shape.set(state[["A", "B", "C"][i]], state[["Aq", "Bq", "Cq"][i]]).show(o.concurrency);
    });
    centrePoint.set(state.F).show(o.concurrency);

    angleMarks[0].set(state.Aq, state.Bq, state.Cq, 21).show(o.angles);
    angleMarks[1].set(state.Bq, state.Cq, state.Aq, 21).show(o.angles);
    angleMarks[2].set(state.Cq, state.Aq, state.Bq, 21).show(o.angles);
    fixedDots.forEach((dot, i) => dot.set(state[["Aq", "Bq", "Cq"][i]]));

    const cells = o.tessellation ? Core.copies(state) : [];
    cellNodes.forEach((node, i) => {
      if (cells[i]) {
        node.setAttribute("points", cells[i].map((p) => p.x.toFixed(2) + "," + p.y.toFixed(2)).join(" "));
        node.style.display = "";
      } else {
        node.style.display = "none";
      }
    });

    names.forEach((shape, i) => {
      const key = nameKeys[i];
      shape.set(state[key]);
      const apex = key === "Ap" || key === "Bp" || key === "Cp";
      shape.show((o.names && !apex) || (o.names && o.hint && apex));
    });

    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    for (const key in checkboxes) checkboxes[key].checked = o[key];

    const angle = Core.angleAt(state.Cq, state.A, state.B) * 180 / Math.PI;
    say(`A\u2032, B\u2032 and C\u2032 form an equilateral triangle. The marked angle at C\u2032 is ${angle.toFixed(0)}\u00b0; the three lines AA\u2032, BB\u2032 and CC\u2032 meet at one point. Drag A, B or C to move the picture.`);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const key in checkboxes) {
    checkboxes[key].addEventListener("change", () => {
      const options = Object.assign({}, state.options, { [key]: checkboxes[key].checked });
      state = Object.assign({}, state, { options: options });
      render();
    });
  }

  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.start(Object.assign({}, state.options));
    render();
  });

  board.onTheme(render);
  render();
})();
