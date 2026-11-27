"use strict";

/*
 * The page for Van Schooten's Locus Problem: drawing and input only.
 * All geometry lives in ellipse-by-van-schooten-core.js. The SVG has two
 * arms through O (with draggable ends X and Y), the triangle ABC, circle L
 * through O, A and B, and -- when "Show hint" is on -- the diameter through C
 * and the two perpendicular lines OP and OQ. Six focusable handles take
 * pointer drags and arrow keys; no shape is rebuilt, so focus survives.
 */

(function () {
  const Core = EllipseByVanSchootenCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const nameBox = document.getElementById("nameBox");
  const hintBox = document.getElementById("hintBox");
  const traceBox = document.getElementById("traceBox");
  const rigidBox = document.getElementById("rigidBox");

  let state = Core.start({});

  /** The line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: guides, trace, triangle, labels, handles on top. */
  const guides = board.layer("guides");
  const trails = board.layer("trails");
  const edges = board.layer("edges");
  const text = board.layer("text");
  const tops = board.layer("handles");

  const armX = board.line(state.O, state.X, "arm", guides);
  const armY = board.line(state.O, state.Y, "arm", guides);
  const circleL = board.circle(state.circle.center, state.circle.radius, "circle-l", guides);
  const diameter = board.segment(state.circle.center, state.C, "diameter", guides);
  const hintPQ = board.line(state.O, state.X, "hint-pq", guides);
  const hintOP = board.line(state.O, state.P || state.X, "hint-axis", guides);
  const hintOQ = board.line(state.O, state.Q || state.Y, "hint-axis", guides);
  const tracePath = board.el("path", null, "trace-curve", trails);
  const edgeAB = board.segment(state.A, state.B, "triangle-edge", edges);
  const edgeAC = board.segment(state.A, state.C, "triangle-edge", edges);
  const edgeBC = board.segment(state.B, state.C, "triangle-edge", edges);
  const labelA = board.label(state.A, "A", "pt-label", 10, -8, text);
  const labelB = board.label(state.B, "B", "pt-label", -18, -8, text);
  const labelC = board.label(state.C, "C", "pt-label", 10, -8, text);
  const labelO = board.label(state.O, "O", "pt-label", -18, 18, text);
  const labelX = board.label(state.X, "X", "pt-label", 6, -8, text);
  const labelY = board.label(state.Y, "Y", "pt-label", -18, -8, text);
  const labelP = board.label(state.O, "P", "pt-label", 8, -8, text);
  const labelQ = board.label(state.O, "Q", "pt-label", -18, 16, text);

  const onArmX = (p) => Core.nearestPoint(p, state.O, state.X);
  const onArmY = (p) => Core.nearestPoint(p, state.O, state.Y);
  const describe = (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`;

  const handles = {
    O: board.handle("O", state.O, {
      r: 9, step: 3, cls: "geom-handle origin-handle", layer: tops,
      label: "Point O, where the two arms meet. Drag it, or use the arrow keys to move the whole picture.",
      describe: describe,
      onMove: (p) => { state = Core.moveO(state, p); render(); },
    }),
    X: board.handle("X", state.X, {
      r: 9, step: 3, cls: "geom-handle", layer: tops,
      label: "Point X, the end of the horizontal arm. Drag it, or use the arrow keys.",
      describe: describe,
      onMove: (p) => { state = Core.moveX(state, p); render(); },
    }),
    Y: board.handle("Y", state.Y, {
      r: 9, step: 3, cls: "geom-handle", layer: tops,
      label: "Point Y, the end of the vertical arm. Drag it, or use the arrow keys.",
      describe: describe,
      onMove: (p) => { state = Core.moveY(state, p); render(); },
    }),
    A: board.handle("A", state.A, {
      r: 9, step: 3, cls: "geom-handle", layer: tops,
      label: "Point A on the horizontal arm. Drag it, or use the arrow keys; B follows when Define triangle is off.",
      describe: describe,
      clamp: (p) => onArmX(p),
      onMove: (p) => { state = Core.moveA(state, p); render(); },
    }),
    B: board.handle("B", state.B, {
      r: 9, step: 3, cls: "geom-handle", layer: tops,
      label: "Point B on the vertical arm. Drag it, or use the arrow keys; A follows when Define triangle is off.",
      describe: describe,
      clamp: (p) => onArmY(p),
      onMove: (p) => { state = Core.moveB(state, p); render(); },
    }),
    C: board.handle("C", state.C, {
      r: 9, step: 3, cls: "geom-handle vertex-handle", layer: tops,
      label: "Point C, the third corner of the triangle. Drag it, or use the arrow keys, to choose the triangle's shape.",
      describe: describe,
      onMove: (p) => { state = Core.moveC(state, p); render(); },
    }),
  };

  function traceDots() {
    const pts = state.trace;
    let path = "";
    for (let i = 0; i < pts.length; i++) {
      if (!Number.isFinite(pts[i].x) || !Number.isFinite(pts[i].y)) continue;
      path += (path ? " L " : "M ") + pts[i].x.toFixed(2) + " " + pts[i].y.toFixed(2);
    }
    tracePath.setAttribute("d", path);
    tracePath.style.display = pts.length > 1 && !!path ? "" : "none";
  }

  function render() {
    state = Core.withConstruction(state);
    armX.set(state.O, state.X);
    armY.set(state.O, state.Y);
    circleL.set(state.circle.center, state.circle.radius);
    diameter.set(state.circle.center, state.C);

    const havePQ = !!(state.P && state.Q && Number.isFinite(state.P.x) && Number.isFinite(state.Q.x));
    hintPQ.show(state.options.hint && havePQ);
    hintOP.show(state.options.hint && havePQ);
    hintOQ.show(state.options.hint && havePQ);
    labelP.show(state.options.names && state.options.hint && havePQ);
    labelQ.show(state.options.names && state.options.hint && havePQ);
    if (havePQ) {
      hintPQ.set(state.P, state.Q);
      hintOP.set(state.O, state.P);
      hintOQ.set(state.O, state.Q);
      labelP.set(state.P, "P");
      labelQ.set(state.Q, "Q");
    }

    edgeAB.set(state.A, state.B);
    edgeAC.set(state.A, state.C);
    edgeBC.set(state.B, state.C);
    labelA.set(state.A, "A");
    labelB.set(state.B, "B");
    labelC.set(state.C, "C");
    labelO.set(state.O, "O");
    labelX.set(state.X, "X");
    labelY.set(state.Y, "Y");
    [labelA, labelB, labelC, labelO, labelX, labelY].forEach((l) => l.show(state.options.names));
    handles.O.set(state.O);
    handles.X.set(state.X);
    handles.Y.set(state.Y);
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    traceDots();

    say(Core.describe(state));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function newGame() {
    state = Core.start({
      names: nameBox.checked, hint: hintBox.checked,
      trace: traceBox.checked, rigid: !rigidBox.checked,
    });
    render();
  }

  newBtn.addEventListener("click", newGame);
  [
    [nameBox, "names"], [hintBox, "hint"], [traceBox, "trace"],
  ].forEach(([box, name]) => {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  });
  rigidBox.addEventListener("change", () => {
    state = Core.setOption(state, "rigid", !rigidBox.checked);
    render();
  });

  nameBox.checked = state.options.names;
  hintBox.checked = state.options.hint;
  traceBox.checked = state.options.trace;
  rigidBox.checked = !state.options.rigid;
  board.onTheme(render);
  render();
})();
