"use strict";

/*
 * The page for In Tangent: drawing and input only. The geometry is in
 * in-tangent-core.js. The board holds triangle ABC with X on side BC; four
 * focusable handles move the points with a pointer or the arrow keys, and the
 * shapes are updated in place so a handle keeps its keyboard focus.
 */

(function () {
  const Core = InTangentCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const circleChk = document.getElementById("circleChk");
  const toTBtn = document.getElementById("toTBtn");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));
  const clamp = Geom.clamp;

  const guides = board.layer("guides");
  const incircles = board.layer("incircles");
  const tangentLayer = board.layer("tangent");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});

  /**
   * Shows the line under the picture. "done" is not a win or a loss: it only
   * tells the player's record that the droodle has been explored (the eyes
   * light up when X is at T).
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const sides = [
    board.segment(state.A, state.B, "side", guides),
    board.segment(state.A, state.C, "side", guides),
    board.segment(state.B, state.C, "side base", guides),
    board.segment(state.A, Core.pointX(state), "axis", guides),
  ];

  const incB = board.circle(state.A, 1, "incircle inc-b", incircles);
  const incC = board.circle(state.A, 1, "incircle inc-c", incircles);
  const bigCircle = board.circle(state.A, 1, "diameter-circle", incircles);
  const centerB = board.point(state.A, "center-dot", 3.5, incircles);
  const centerC = board.point(state.A, "center-dot", 3.5, incircles);
  const bigCenter = board.point(state.A, "center-dot big", 3.5, incircles);

  const tangent = board.line(state.A, state.B, "tangent", tangentLayer);
  const contactB = board.point(state.A, "contact-dot", 3, tangentLayer);
  const contactC = board.point(state.A, "contact-dot", 3, tangentLayer);
  const tMark = board.point(state.A, "t-ring", 6, marks);
  const sMark = board.point(state.A, "s-dot", 3.5, marks);

  const labels = {
    A: board.label(state.A, "A", "point-label", -12, -8, labelsLayer),
    B: board.label(state.B, "B", "point-label", -13, 16, labelsLayer),
    C: board.label(state.C, "C", "point-label", 7, 16, labelsLayer),
    X: board.label(state.A, "X", "point-label x-label", 6, 18, labelsLayer),
    T: board.label(state.A, "T", "point-label t-label", -16, 20, labelsLayer),
  };

  // Three little eyes, in the corners where the applet drew its mouse eyes.
  const eyes = [{ x: 50, y: 30 }, { x: 320, y: 90 }, { x: 230, y: 25 }].map((p) => {
    const outer = board.el("circle", { cx: p.x, cy: p.y, r: 9 }, "eye", marks);
    const pupil = board.el("circle", { cx: p.x, cy: p.y, r: 3 }, "eye-pupil", marks);
    return { outer: outer, pupil: pupil };
  });

  function clampVertex(q) {
    return {
      x: clamp(q.x, 14, state.width - 14),
      y: clamp(q.y, 14, state.height - 14),
    };
  }

  function clampX(q) {
    // X stays on BC. The 2%-98% bounds keep both small triangles non-degenerate.
    const t = clamp(Core.moveX(state, q).t, 0.02, 0.98);
    return Core.pointX({ ...state, t: t });
  }

  const handleOpts = {
    r: 8, step: 2, shift: 10, layer: handlesLayer, clamp: clampVertex,
  };
  const handles = {
    A: board.handle("A", state.A, {
      ...handleOpts,
      label: "Point A, the top corner. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p) => { state = Core.moveVertex(state, "A", p); render(); },
    }),
    B: board.handle("B", state.B, {
      ...handleOpts,
      label: "Point B, the left end of the base. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p) => { state = Core.moveVertex(state, "B", p); render(); },
    }),
    C: board.handle("C", state.C, {
      ...handleOpts,
      label: "Point C, the right end of the base. Drag it, or focus it and use the arrow keys to move it.",
      onMove: (p) => { state = Core.moveVertex(state, "C", p); render(); },
    }),
  };
  const xHandle = board.handle("X", Core.pointX(state), {
    r: 8, step: 1, shift: 5, layer: handlesLayer, clamp: clampX,
    label: "Point X on the base line. Drag it along the line, or focus it and use the arrow keys.",
    onMove: (p) => { state = Core.moveX(state, p); render(); },
  });

  function render() {
    const g = Core.analyze(state);
    const X = g.X;

    sides[0].set(g.A, g.B);
    sides[1].set(g.A, g.C);
    sides[2].set(g.B, g.C);
    sides[3].set(g.A, X);

    incB.set(g.IB, g.incBX.radius);
    incC.set(g.IC, g.incCX.radius);
    bigCircle.set(g.circle.center, g.circle.radius);
    centerB.set(g.IB);
    centerC.set(g.IC);
    bigCenter.set(g.circle.center);
    bigCircle.show(state.showCircle);
    bigCenter.show(state.showCircle);

    tangent.set(g.A2, g.X2);
    contactB.set(g.TB);
    contactC.set(g.TC);
    tMark.set(g.T);
    if (g.S) sMark.set(g.S);
    sMark.show(!!g.S);

    labels.A.set(g.A, "A", -12, -8);
    labels.B.set(g.B, "B", -13, 16);
    labels.C.set(g.C, "C", 7, 16);
    labels.X.set(X, "X", 6, 18);
    labels.T.set(g.T, "T", -16, 20);

    for (const eye of eyes) {
      eye.outer.classList.toggle("on", g.finished);
      eye.pupil.classList.toggle("on", g.finished);
    }

    handles.A.set(g.A);
    handles.B.set(g.B);
    handles.C.set(g.C);
    xHandle.set(X);

    if (g.finished) {
      say("X sits at T, where the big incircle touches the base: the eyes light up. The other tangent still goes through T.", "done");
    } else {
      say("The bright line meets the base at T, the touch point of the big incircle. X is on the circle through the two centres.");
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  circleChk.addEventListener("change", () => {
    state = { ...state, showCircle: circleChk.checked };
    render();
  });
  toTBtn.addEventListener("click", () => {
    state = Core.moveXToT(state);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    circleChk.checked = state.showCircle;
    render();
  });

  board.onTheme(() => render());
  render();
})();
