"use strict";

/*
 * The page for Deco Symmetry 4: drawing and input only. All the geometry is in
 * deco-symmetry-4-core.js. A 400 by 250 SVG board holds the triangle ABC, its
 * mirror A'B'C', the two cuts from A' to D and E, and the three coloured
 * pieces. Drag A freely or slide B and C along the base with a pointer or with
 * the arrow keys. "Move them" turns the outer pieces half way round, as the
 * applet's thread did in 50 steps; "Show names" and "Show hint" are the
 * applet's two checkboxes.
 */

(function () {
  const Core = DecoSymmetry4Core;
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const moveBtn = document.getElementById("moveBtn");
  const resetBtn = document.getElementById("resetBtn");

  const board = Geom.board(document.getElementById("board"));
  const piecesLayer = board.layer("pieces");
  const guidesLayer = board.layer("guides");
  const cutsLayer = board.layer("cuts");
  const edgesLayer = board.layer("edges");
  const hintsLayer = board.layer("hints");
  const dotsLayer = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start();
  let figure = Core.compute(state);
  let moving = false;
  let moved = false;
  let progress = 0;
  let timer = null;

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

  const blank = { x: 0, y: 0 };
  const pieceFill = figure.pieces.map((p, i) => board.polygon(p.points, "piece-fill piece-" + i, piecesLayer));
  const cutLines = [
    board.segment(blank, blank, "cut-line", cutsLayer),
    board.segment(blank, blank, "cut-line", cutsLayer),
  ];
  const sourceEdges = ["AB", "BC", "CA"].map(() => board.segment(blank, blank, "tri-edge", edgesLayer));
  const mirrorEdges = ["AB", "BC", "CA"].map(() => board.segment(blank, blank, "mirror-edge", edgesLayer));
  const pairs = [0, 1, 2].map(() => board.segment(blank, blank, "pair-line", guidesLayer));
  const cutDots = [board.point(blank, "aux-dot", 3.5, dotsLayer), board.point(blank, "aux-dot", 3.5, dotsLayer)];

  // The applet's hint marks eight right angles of the two interlocking grids.
  const rightAngles = [
    ["A", "Bp", "Ap"], ["A", "Cp", "Ap"],
    ["Ap", "B", "A"], ["Ap", "C", "A"],
    ["B", "C", "Bp"], ["Bp", "Cp", "B"],
    ["C", "B", "Cp"], ["Cp", "Bp", "C"],
  ].map(([v, p, q]) => board.rightAngle(blank, blank, blank, 8, "hint-mark", hintsLayer));

  const labels = {};
  for (const name of ["A", "B", "C", "A'", "B'", "C'", "D", "E"]) {
    labels[name] = board.label(blank, name, "point-label", 6, -7, labelsLayer);
  }

  const vertex = ["A", "B", "C"];
  const handles = {};
  for (const name of vertex) {
    handles[name] = board.handle(name, state[name], {
      r: 9,
      step: 2,
      shift: 10,
      cls: "geom-handle vertex-handle",
      label: "Point " + name + (name === "A" ? " at the top" : " on the base") +
        ". Drag it, or focus it and use the arrow keys.",
      clamp: (q, key) => Core.clampPoint(state, key, q),
      onMove: (p, key) => {
        stopAnimation();
        state = Core.move(state, key, p);
        render();
      },
      layer: handlesLayer,
    });
  }

  function stopAnimation() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    moving = false;
    moved = false;
    progress = 0;
  }

  /** Where each coloured piece sits right now: original, turning, or moved. */
  function pieceAt(index) {
    const piece = figure.pieces[index];
    if (moving) return Core.movingPoints(figure, index, progress);
    if (moved && piece.final) return piece.final;
    return piece.points;
  }

  function render() {
    figure = Core.compute(state);
    const { A, B, C, Ap, Bp, Cp, D, E, valid } = figure;

    figure.pieces.forEach((piece, i) => {
      const pts = pieceAt(i);
      const usable = valid && pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      pieceFill[i].show(usable).set(pts);
    });

    const showCuts = valid && !moving && !moved;
    cutLines[0].show(showCuts).set(Ap, D);
    cutLines[1].show(showCuts).set(Ap, E);
    cutDots[0].show(showCuts).set(D);
    cutDots[1].show(showCuts).set(E);

    [[A, B], [B, C], [C, A]].forEach(([p, q], i) => sourceEdges[i].set(p, q));
    [[Ap, Bp], [Bp, Cp], [Cp, Ap]].forEach(([p, q], i) => mirrorEdges[i].set(p, q));
    [[A, Ap], [B, Bp], [C, Cp]].forEach(([p, q], i) => pairs[i].set(p, q));

    const marks = {
      A, Ap, Bp, Cp, B, C,
    };
    rightAngles.forEach((mark, i) => {
      const [v, p, q] = [
        ["A", "Bp", "Ap"], ["A", "Cp", "Ap"],
        ["Ap", "B", "A"], ["Ap", "C", "A"],
        ["B", "C", "Bp"], ["Bp", "Cp", "B"],
        ["C", "B", "Cp"], ["Cp", "Bp", "C"],
      ][i];
      mark.show(state.showHint).set(marks[v], marks[p], marks[q], 8);
    });

    const where = {
      A: [A, A.x < 24 ? 8 : -14, -9], B: [B, B.x < 24 ? 8 : -14, 18], C: [C, 7, 18],
      "A'": [Ap, 7, 18], "B'": [Bp, Bp.x < 26 ? 7 : -18, -8], "C'": [Cp, 7, -8],
      D: [D, 6, -8], E: [E, 6, -8],
    };
    for (const name in labels) {
      const [p, dx, dy] = where[name];
      const used = (name === "D" || name === "E") ? valid : true;
      labels[name].show(state.showNames && used).set(p, name, dx, dy);
    }

    for (const name of vertex) handles[name].set(state[name]);
    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;
    moveBtn.disabled = !valid || moving;
    moveBtn.textContent = moving ? "Moving…" : moved ? "Moved" : "Move them";

    say(Core.describe(figure, moved));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /** The applet's 50 steps, ten milliseconds apart: a half turn of each end piece. */
  function moveThem() {
    if (!figure.valid || moving) return;
    moving = true;
    moved = false;
    progress = 0;
    let step = 0;
    function tick() {
      step++;
      progress = step / 50;
      if (step >= 50) {
        moving = false;
        moved = true;
        timer = null;
        render();
        return;
      }
      render();
      timer = setTimeout(tick, 10);
    }
    tick();
  }

  for (const [box, key] of [[namesBox, "showNames"], [hintBox, "showHint"]]) {
    box.addEventListener("change", () => {
      stopAnimation(); // the applet clears ShowMoving when a checkbox changes
      state = Core.option(state, key, box.checked);
      render();
    });
  }
  moveBtn.addEventListener("click", moveThem);
  resetBtn.addEventListener("click", () => {
    stopAnimation();
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
