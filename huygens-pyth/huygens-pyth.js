"use strict";

/*
 * The browser view of Huygens' proof. All the geometry lives in
 * huygens-pyth-core.js; this file only draws it and takes input.
 *
 * The board shows the right triangle ABC, the three squares on its sides, and
 * the two strips ABML and KMLS that Huygens cuts from the square on AB. Drag
 * A or B to change the triangle (C is rebuilt at the same angle), or drag C
 * around the circle through A and B. The two checkboxes are the applet's own
 * "names" and "hint" switches.
 */

(() => {
  const Core = HuygensPythCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesCheck = document.getElementById("namesCheck");
  const hintCheck = document.getElementById("hintCheck");
  const resetBtn = document.getElementById("resetBtn");
  const readoutEl = document.getElementById("readout");

  const fills = board.layer("fills");
  const squares = board.layer("squares");
  const proof = board.layer("proof");
  const dots = board.layer("dots");
  const marks = board.layer("marks");
  const text = board.layer("text");
  const handlesLayer = board.layer("handles");

  let state = Core.start();
  let message = "";
  // The applet swaps the A and B *references* in UpgradePoints, not the dots.
  // These names follow the three physical handles when that happens.
  const handleNames = ["A", "B", "C"];

  // The applet's ShowHint fills four triangles: two pink, two yellow.
  const hintPink1 = board.polygon([], "hint hint-pink", fills);
  const hintPink2 = board.polygon([], "hint hint-pink", fills);
  const hintYellow1 = board.polygon([], "hint hint-yellow", fills);
  const hintYellow2 = board.polygon([], "hint hint-yellow", fills);
  const stripABML = board.polygon([], "strip strip-first", fills);
  const stripKMLS = board.polygon([], "strip strip-second", fills);
  const triangle = board.polygon([], "triangle", fills);

  const squareAB = board.polygon([], "square square-ab", squares);
  const squareAC = board.polygon([], "square square-ac", squares);
  const squareBC = board.polygon([], "square square-bc", squares);

  const proofLines = [];
  for (let i = 0; i < 7; i++) proofLines.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "proof-line", proof));

  const constructed = [];
  for (let i = 0; i < 10; i++) constructed.push(board.point({ x: 0, y: 0 }, "dot", 3.5, dots));

  const rightMark = board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 12, "right-mark", marks);

  const NAMES = [
    ["A", "A"], ["B", "B"], ["C", "C"],
    ["S", "Bp"], ["K", "Ap"], ["L", "L"], ["M", "M"],
    ["N", "N"], ["P", "P"], ["G", "Cp"], ["F", "Bq"],
    ["E", "Aq"], ["D", "Cq"],
  ];
  const labels = NAMES.map(([letter]) => board.label({ x: 0, y: 0 }, letter, "point-label", 7, -7, text));

  /** Status line. A demo has no win or loss; "done" is never used here. */
  function say(line, kind) {
    statusEl.textContent = line;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const round = (n) => Math.round(n).toLocaleString("en-US");

  function render() {
    const g = Core.stats(state);
    const showNames = state.showNames;
    const showHint = state.showHint;

    squareAB.set([g.A, g.B, g.Ap, g.Bp]);
    squareAC.set([g.A, g.C, g.Bq, g.Cp]);
    squareBC.set([g.B, g.C, g.Aq, g.Cq]);
    triangle.set([g.A, g.B, g.C]);
    stripABML.set([g.A, g.B, g.M, g.L]);
    stripKMLS.set([g.Ap, g.M, g.L, g.Bp]);

    hintPink1.set([g.A, g.B, g.P]).show(showHint);
    hintPink2.set([g.C, g.Cp, g.A]).show(showHint);
    hintYellow1.set([g.C, g.Cq, g.B]).show(showHint);
    hintYellow2.set([g.Bp, g.Ap, g.P]).show(showHint);

    const proofPoints = [
      [g.A, g.N], [g.B, g.N], [g.A, g.P], [g.B, g.P],
      [g.L, g.M], [g.Bp, g.P], [g.Ap, g.P],
    ];
    proofLines.forEach((segment, i) => segment.set(proofPoints[i][0], proofPoints[i][1]));

    const dotsAt = [g.L, g.M, g.N, g.P, g.Ap, g.Aq, g.Bp, g.Bq, g.Cp, g.Cq];
    constructed.forEach((dot, i) => dot.set(dotsAt[i]));
    rightMark.set(g.C, g.A, g.B, 12);

    labels.forEach((label, i) => {
      label.set(g[NAMES[i][1]], NAMES[i][0], 7, -7).show(showNames);
    });

    [aHandle, bHandle, cHandle].forEach((handle, i) => handle.set(g[handleNames[i]]));

    readoutEl.textContent =
      `${round(g.lengths.AC)}² + ${round(g.lengths.BC)}² = ${round(g.areas.squareAC + g.areas.squareBC)}` +
      ` = ${round(g.areas.squareAB)} = ${round(g.lengths.AB)}²`;

    const defaultLine = showHint
      ? "The shaded triangles are the halves the proof compares. Keep moving the corners."
      : "The two strips on the square over AB have exactly the area of the two smaller squares together.";
    say(message || defaultLine);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveHandle(index, target) {
    const result = Core.withPointDetailed(state, handleNames[index], target);
    if (!result) {
      message = "That spot makes the triangle collapse. Drag back to a place where the figure draws.";
      render();
      return;
    }
    state = result.state;
    if (result.swapped) {
      // The dot the player is holding keeps its identity; only its name changes.
      [handleNames[0], handleNames[1]] = [handleNames[1], handleNames[0]]; // A <-> B
    }
    message = "";
    render();
  }

  const clampCorner = (p) => ({
    x: Math.max(70, Math.min(430, p.x)),
    y: Math.max(45, Math.min(405, p.y)),
  });
  const clampC = (p) => ({
    x: Math.max(50, Math.min(450, p.x)),
    y: Math.max(30, Math.min(420, p.y)),
  });

  const aHandle = board.handle("A", state.A, {
    r: 12, step: 5, shift: 4, cls: "geom-handle corner-handle",
    label: "Triangle corner. Drag it, or focus it and use the arrow keys, to change the triangle.",
    clamp: clampCorner, layer: handlesLayer, onMove: (p) => moveHandle(0, p),
  });
  const bHandle = board.handle("B", state.B, {
    r: 12, step: 5, shift: 4, cls: "geom-handle corner-handle",
    label: "Triangle corner. Drag it, or focus it and use the arrow keys, to change the triangle.",
    clamp: clampCorner, layer: handlesLayer, onMove: (p) => moveHandle(1, p),
  });
  const cHandle = board.handle("C", state.C, {
    r: 12, step: 5, shift: 4, cls: "geom-handle right-handle",
    label: "Point C, the right angle. Drag it around the circle, or focus it and use the arrow keys, to change the two legs.",
    clamp: clampC, layer: handlesLayer, onMove: (p) => moveHandle(2, p),
  });

  namesCheck.addEventListener("change", () => {
    state = Core.withOption(state, "showNames", namesCheck.checked);
    message = "";
    render();
  });
  hintCheck.addEventListener("change", () => {
    state = Core.withOption(state, "showHint", hintCheck.checked);
    message = "";
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start();
    [handleNames[0], handleNames[1]] = ["A", "B"];
    namesCheck.checked = false;
    hintCheck.checked = false;
    message = "";
    render();
  });

  board.onTheme(render);
  render();
})();
