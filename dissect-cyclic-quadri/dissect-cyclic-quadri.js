"use strict";

/*
 * Dissection of a Cyclic Quadrilateral — drawing and input only.  All the
 * geometry is in dissect-cyclic-quadri-core.js: A,B,C,D glide on the guide
 * circle, P is free, and R,M,N,Q glide on the side lines AB,BC,CD,DA.  Each
 * redraw only updates the SVG elements created once at start-up, so a handle
 * keeps keyboard focus after a move.  "Perpendicular feet" applies the
 * article's construction; "Build from N" applies its alternate construction.
 */

(function () {
  const Core = DissectCyclicQuadriCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hint");
  const boxes = {
    names: document.getElementById("names"),
    helper: document.getElementById("helper"),
    hint: hintBox,
  };

  let state = Core.start();

  /* Back to front. */
  const guide = board.layer("guide");
  const pieces = board.layer("pieces");
  const cuts = board.layer("cuts");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const baseCircle = board.circle(Core.GUIDE.c, Core.GUIDE.r, "guide-circle", guide);
  const outline = board.polygon([state.A, state.B, state.C, state.D], "outline", guide);
  const pieceShapes = Core.QUADS.map((q) => board.polygon(
    [state[q.u], state[q.v], state[q.w], state.P], "piece", pieces,
  ));
  const cutLines = ["R", "M", "N", "Q"].map((k) => board.segment(state.P, state[k], "cut", cuts));
  const cyclicCircles = Core.QUADS.map(() => board.circle(state.P, 1, "cyclic-circle", marks));
  const hintCircles = [
    board.circle(state.P, 1, "hint-circle", marks),
    board.circle(state.P, 1, "hint-circle", marks),
    board.circle(state.P, 1, "hint-circle", marks),
    board.circle(state.P, 1, "hint-circle", marks),
  ];
  const helperArcs = [
    board.angleArc(state.B, state.R, state.M, 18, "helper-mark", marks),
    board.angleArc(state.C, state.M, state.N, 18, "helper-mark", marks),
    board.angleArc(state.D, state.N, state.Q, 18, "helper-mark", marks),
    board.angleArc(state.A, state.Q, state.R, 18, "helper-mark", marks),
  ];
  const rightAngles = ["M", "N", "Q", "R"].map(() =>
    board.rightAngle(state.P, state.B, state.M, 8, "right-angle", marks));

  const labelKeys = Core.HANDLES;
  const labelNodes = {};
  for (const key of labelKeys) labelNodes[key] = board.label(state[key], key, "point-label", 8, -8, labels);

  const cornerNames = ["A", "B", "C", "D"];
  const cutNames = ["R", "M", "N", "Q"];
  const handles = {};
  for (const name of cornerNames) {
    handles[name] = board.handle(name, state[name], {
      step: 3, shift: 12, r: 9, layer: top,
      label: `Corner ${name}. Drag it around the circle, or focus it and use the arrow keys.`,
      clamp: (q) => Core.clampToCircle(q),
      onMove: (q, who) => { state = Core.move(state, who, q); render(); },
    });
  }
  handles.P = board.handle("P", state.P, {
    step: 3, shift: 12, r: 9, layer: top,
    label: "Point P. Drag it anywhere, or focus it and use the arrow keys.",
    clamp: (q) => Core.clampToView(q),
    onMove: (q, who) => { state = Core.move(state, who, q); render(); },
  });
  for (const name of cutNames) {
    handles[name] = board.handle(name, state[name], {
      step: 3, shift: 12, r: 8, layer: top,
      label: `Cut point ${name}. Drag it along its side, or focus it and use the arrow keys.`,
      clamp: (q, who) => Core.clampToView(q),
      onMove: (q, who) => { state = Core.move(state, who, q); render(); },
    });
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function placeCircles() {
    const hints = [
      [state.M, state.C, state.P], [state.N, state.D, state.P],
      [state.Q, state.A, state.P], [state.R, state.B, state.P],
    ];
    for (let i = 0; i < 4; i++) {
      const cc = Core.exactCircle(hints[i][0], hints[i][1], hints[i][2]);
      hintCircles[i].show(!!cc).set(hints[i][0], 1);
      if (cc) hintCircles[i].set(cc.c, cc.r);
    }
  }

  function placeRightAngles() {
    const feet = Core.feet(state);
    const specs = [
      [feet.M, state.C, state.P], [feet.N, state.D, state.P],
      [feet.Q, state.A, state.P], [feet.R, state.B, state.P],
    ];
    for (let i = 0; i < 4; i++) {
      rightAngles[i].show(state.fromFeet).set(specs[i][0], specs[i][1], specs[i][2], 8);
    }
  }

  function render() {
    const g = Core.geometry(state);
    baseCircle.set(Core.GUIDE.c, Core.GUIDE.r);
    outline.set([state.A, state.B, state.C, state.D]);

    for (const name of Core.HANDLES) handles[name].set(state[name]);

    for (let i = 0; i < Core.QUADS.length; i++) {
      const q = Core.QUADS[i];
      pieceShapes[i].set([state[q.u], state[q.v], state[q.w], state.P]);
      pieceShapes[i].node.classList.toggle("on", g.quads[i].cyclic);
      const cc = g.quads[i].circle;
      cyclicCircles[i].show(!!cc);
      if (cc) cyclicCircles[i].set(cc.c, cc.r);
    }
    for (let i = 0; i < cutNames.length; i++) cutLines[i].set(state.P, state[cutNames[i]]);

    helperArcs[0].set(state.B, state.R, state.M, 18);
    helperArcs[1].set(state.C, state.M, state.N, 18);
    helperArcs[2].set(state.D, state.N, state.Q, 18);
    helperArcs[3].set(state.A, state.Q, state.R, 18);
    for (const arc of helperArcs) arc.show(state.options.helper);

    hintBox.disabled = !g.hintEnabled;
    hintBox.checked = g.showHint;
    placeCircles();
    for (const h of hintCircles) h.show(g.showHint);
    placeRightAngles();

    for (const key of cornerNames.concat("P")) labelNodes[key].show(state.options.names).set(state[key]);
    labelNodes.R.show(state.options.names
      && Core.dist(state.R, state.B) > 10 && Core.dist(state.R, state.A) > 10).set(state.R);
    labelNodes.M.show(state.options.names
      && Core.dist(state.M, state.C) > 10 && Core.dist(state.M, state.B) > 10).set(state.M);
    labelNodes.N.show(state.options.names
      && Core.dist(state.N, state.C) > 10 && Core.dist(state.N, state.D) > 10).set(state.N);
    labelNodes.Q.show(state.options.names
      && Core.dist(state.Q, state.D) > 10 && Core.dist(state.Q, state.A) > 10).set(state.Q);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D, P: state.P,
        R: state.R, M: state.M, N: state.N, Q: state.Q,
        coef: state.coef, options: state.options,
        cyclic: g.quads.map((quad) => quad.cyclic), count: g.count,
        fromFeet: state.fromFeet,
      });
    }
  }

  for (const name of Object.keys(boxes)) {
    boxes[name].addEventListener("change", () => {
      state = Core.setOption(state, name, boxes[name].checked);
      render();
    });
  }
  document.getElementById("feetBtn").addEventListener("click", () => {
    state = Core.useFeet(state);
    render();
  });
  document.getElementById("fromNBtn").addEventListener("click", () => {
    state = Core.solveFromN(state);
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render); // SVG colours are CSS classes; redraw for the shared hook
  render();
})();
