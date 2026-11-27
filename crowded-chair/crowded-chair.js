"use strict";

/*
 * The page for Crowded Chair: drawing and input only; all geometry is in
 * crowded-chair-core.js. An SVG board holds the triangle, its three squares
 * and the circle. A, B and C are Geom handles, so a pointer or the arrow keys
 * can move them; the three checkboxes and Reset reproduce the applet's panel.
 */

(function () {
  const Core = CrowdedChairCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circle: board.layer("circle"),
    fills: board.layer("fills"),
    sides: board.layer("sides"),
    squares: board.layer("squares"),
    guides: board.layer("guides"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);
  // During a pointer drag the picture follows the pointer without committing
  // a move; the applet's A/B swap is applied once, on release.
  let dragging = null;
  let preview = null;

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const mainCircle = board.circle({ x: 200, y: 180 }, 90, "maincircle", layers.circle);
  const triFill = board.polygon([state.A, state.B, state.C], "tri-fill", layers.fills);
  const squareFills = [0, 1, 2].map(() => board.polygon([state.A], "square-fill", layers.fills));

  const sides = [0, 1, 2].map(() => board.segment(state.A, state.B, "side", layers.sides));
  const squareEdges = Array.from({ length: 12 }, () =>
    board.segment(state.A, state.B, "square-edge", layers.squares));
  const keyLines = [0, 1, 2, 3].map(() => board.segment(state.A, state.B, "keyline", layers.guides));
  const statementLines = [0, 1].map(() => board.segment(state.A, state.B, "statementline", layers.guides));
  const diagonals = [0, 1].map(() => board.segment(state.A, state.B, "diagonal", layers.marks));
  const rightMarks = [0, 1].map(() => board.rightAngle(state.A, state.B, state.C, 9, "rightmark", layers.marks));
  const centreDot = board.point({ x: 200, y: 180 }, "centredot", 3.2, layers.dots);
  const crossDots = [0, 1].map(() => board.point(state.A, "crossdot", 4.4, layers.dots));
  const auxDots = Array.from({ length: 6 }, () => board.point(state.A, "auxdot", 3.2, layers.dots));

  const labelOffsets = {
    A: [-11, -9], B: [4, -9], C: [6, 17], H: [-11, -8], G: [5, -8],
    K: [-12, -8], F: [-12, -8], E: [-12, 16], D: [5, 16], U: [6, -8], V: [6, 16],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "point-label geom-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  /** A live picture for a pointer drag; the committed move follows on release. */
  function previewState(name, point) {
    if (name === "C") return { ...state, C: point };
    const A = name === "A" ? point : state.A;
    const B = name === "B" ? point : state.B;
    const Cc = Core.computeC(A, B, state.angleA);
    return { ...state, [name]: point, C: Core.finite(Cc) ? Cc : state.C };
  }

  /** Keyboard steps commit at once; pointer steps update the live picture. */
  function handleMove(point, name) {
    if (dragging === name) {
      preview = previewState(name, point);
      render();
      return;
    }
    apply({ type: "point", name, point }, "Moved " + name + " to (" +
      Math.round(point.x) + ", " + Math.round(point.y) + ").");
  }

  const clampToBoard = (q) => Core.clampPoint(q);
  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 3,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: name === "C" ? (q) => {
        const circle = Core.circleThrough(state.A, state.B, state.C);
        if (!circle) return state.C;
        const dx = q.x - circle.center.x, dy = q.y - circle.center.y;
        const d = Math.hypot(dx, dy);
        return d < 1e-9 ? state.C : {
          x: circle.center.x + (dx / d) * circle.radius,
          y: circle.center.y + (dy / d) * circle.radius,
        };
      } : clampToBoard,
      onMove: handleMove,
    });
  }

  /* Commit a pointer drag only on release: the applet's UpgradePoints swaps
     A and B, so committing on every move would drag the wrong corner next. */
  function finishDrag() {
    if (!dragging) return;
    const name = dragging;
    const point = preview ? preview[name] : state[name];
    dragging = null;
    preview = null;
    apply({ type: "point", name, point }, "Moved " + name + " to (" +
      Math.round(point.x) + ", " + Math.round(point.y) + ").");
  }
  board.root.addEventListener("pointerdown", (e) => {
    const hit = Core.NAMES.find((name) => handles[name].node === e.target);
    if (!hit) return;
    dragging = hit;
    preview = { ...state };
  });
  board.root.addEventListener("pointerup", finishDrag);
  board.root.addEventListener("pointercancel", finishDrag);
  board.root.addEventListener("lostpointercapture", finishDrag);

  function show(shape, on) { shape.show(!!on); return shape; }

  function draw(shown) {
    const position = shown || state;
    geometry = Core.compute(position);
    triFill.set([position.A, position.B, position.C]);
    for (const name of Core.NAMES) handles[name].set(position[name]);

    if (geometry.degenerate) {
      for (const shape of [mainCircle, triFill, centreDot, ...squareFills, ...sides,
        ...squareEdges, ...keyLines, ...statementLines, ...diagonals, ...rightMarks,
        ...crossDots, ...auxDots]) show(shape, false);
      for (const name of Object.keys(labels)) show(labels[name], false);
      return;
    }

    const { A, B, C, K, H, G, F, E, D, U, V, circle } = geometry;
    const squareAB = [A, E, D, B];
    const squareAC = [A, F, G, C];
    const squareBC = [B, H, K, C];
    squareFills[0].set(squareAB).show(true);
    squareFills[1].set(squareAC).show(true);
    squareFills[2].set(squareBC).show(true);
    mainCircle.set(circle.center, circle.radius).show(true);
    centreDot.set(circle.center).show(true);

    // The triangle's three sides: AB, BC and CA.
    sides[0].set(A, B).show(true);
    sides[1].set(B, C).show(true);
    sides[2].set(C, A).show(true);

    const edgePairs = [
      [A, E], [E, D], [D, B], [B, A],
      [A, F], [F, G], [G, C], [C, A],
      [B, H], [H, K], [K, C], [C, B],
    ];
    edgePairs.forEach((pair, i) => squareEdges[i].set(pair[0], pair[1]).show(true));

    // The four long lines the page talks about, drawn as in the applet.
    keyLines[0].set(B, F).show(true);
    keyLines[1].set(A, K).show(true);
    keyLines[2].set(C, E).show(true);
    keyLines[3].set(C, D).show(true);
    statementLines[0].set(A, K).show(state.showStatement);
    statementLines[1].set(B, F).show(state.showStatement);
    diagonals[0].set(A, D).show(state.showHint);
    diagonals[1].set(B, E).show(state.showHint);
    rightMarks[0].set(U, E, B, 9).show(state.showHint);
    rightMarks[1].set(V, A, D, 9).show(state.showHint);

    [H, K, G, F, E, D].forEach((p, i) => auxDots[i].set(p).show(true));
    crossDots[0].set(U).show(true);
    crossDots[1].set(V).show(true);

    const positions = { A, B, C, H, G, K, F, E, D, U, V };
    for (const name of Object.keys(labels)) {
      labels[name].set(positions[name]).show(state.showNames);
    }
  }

  function statusText() {
    if (geometry.degenerate) return "Put the three corners apart so the chair takes shape.";
    if (state.showHint) {
      return "AD and BE are diameters. Right angles at V (AK meets CD) and U (CE meets BF) put U and V on the circle.";
    }
    if (state.showStatement) {
      return "The dashed lines AK and BF cross at V and U. Both crossings sit on the circle through A, B, D and E.";
    }
    return "Drag A, B or C: U and V stay on the circle through A, B, D and E.";
  }

  /** Redraw, speak the state and save the position for the player's record. */
  function render() {
    const shown = preview || state;
    draw(shown);
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      if (m.type === "point") handles[m.name].set(state[m.name]);
      say("That spot will not work; try a different one.", Core.result(state));
      return false;
    }
    state = next;
    render();
    if (note) say(note, Core.result(state));
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showStatement: document.getElementById("statementBox"),
    showHint: document.getElementById("hintBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked },
        box.checked ? "Showing " + box.dataset.label + "." : "Hid " + box.dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening chair.");
  });

  // Colours are CSS classes, so a theme flip only needs a redraw of the SVG.
  board.onTheme(() => draw());

  render();
})();
