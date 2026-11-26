"use strict";

/*
 * The page for APMO2009_3: drawing and input only. The geometry and the
 * extremal claim live in apmo-2009-3-core.js. An SVG board holds the triangle
 * on its fixed horizontal base, the line that fixes A's height, the
 * circumcircle and (with the two hint switches) T, S and the circle through
 * B, C and T. Four focusable Geom handles let a pointer or the arrow keys move
 * A, B, C and the height line; Reset brings back the opening picture.
 */

(function () {
  const Core = Apmo20093Core;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    guides: board.layer("guides"),
    circles: board.layer("circles"),
    triangle: board.layer("triangle"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** The status line. "done" is how a demo tells the player's record it was
   *  explored; it is set by render() from Core.result(). */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* The shapes are made once and re-set on every redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const baseLine = board.line(state.B, state.C, "base-line", layers.guides);
  const heightLine = board.line({ x: 0, y: state.A.y }, { x: Core.WIDTH, y: state.A.y },
    "height-line", layers.guides);
  const vertical = board.line(geometry.Am, geometry.A0m, "vertical-guide", layers.guides);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);
  const circum = board.circle(state.A, 50, "circumcircle", layers.circles);
  const circle1 = board.circle(state.A, 50, "circle1", layers.circles);
  const radiusMarks = [
    board.segment(geometry.O, geometry.Bm, "radiusmark", layers.marks),
    board.segment(geometry.O, geometry.Cm, "radiusmark", layers.marks),
  ];
  const hintSegments = ["TB", "TC", "SB", "SC"].map(() =>
    board.segment(state.A, state.B, "hintsegment", layers.marks));

  const centerDot = board.point(state.A, "centerdot", 3.5, layers.dots);
  const midDot = board.point(geometry.Am, "middot", 4, layers.dots);
  const sideDots = [0, 1].map(() => board.point(state.A, " sidedot", 3.5, layers.dots));
  const hintDots = [0, 1, 2, 3].map(() => board.point(state.A, "hintdot", 3.5, layers.dots));
  const Tdot = board.point(geometry.T, "extremedot", 6, layers.dots);
  const Sdot = board.point(geometry.S, "extremedot", 6, layers.dots);

  const labelOffsets = {
    A: [-5, -12], B: [-7, 18], C: [9, 3], O: [8, -8],
    M: [-8, 18], Bm: [-14, -10], Cm: [8, -10], T: [-18, -9], S: [-18, -9],
    h: [8, -7],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const notes = {
    A: "Moved A along its height line.",
    B: "Moved the end B of the base.",
    C: "Moved the end C of the base.",
    height: "Changed the height of A's line.",
  };
  const handles = {};
  for (const name of Core.HANDLES) {
    const at = name === "height" ? { x: Core.LINE_X, y: state.A.y } : state[name];
    const description = name === "height"
      ? "Height line. Drag it up or down, or focus it and use the arrow keys to change the height"
      : "Point " + name + ". Drag it along its line, or focus it and use the arrow keys to move it";
    handles[name] = board.handle(name, at, {
      r: name === "height" ? 8 : 11,
      step: 3,
      cls: "geom-handle" + (name === "height" ? " height-handle" : " corner-handle"),
      label: description,
      describe: (p) => (name === "height" ? "height " + Math.round(Core.BASE_Y - p.y)
        : "at board position " + Math.round(p.x) + ", " + Math.round(p.y)) + ".",
      clamp: (q) => Core.clampHandle(name, q, state),
      onMove: (p, which) => apply({ type: "point", name: which, point: p }, notes[which]),
    });
  }

  function statusText() {
    const g = geometry;
    if (g.degenerate) return "Move the points apart so they make a triangle.";
    const best = g.best.best;
    const pct = Math.round((100 * g.product) / best.product);
    const peak = best.kind === "isosceles"
      ? "It is biggest when A sits above the middle of BC, so AB = AC."
      : "It is biggest when the angle at A is a right angle, not at AB = AC.";
    const verdict = g.best.holds
      ? "The page's claim holds here: the base is not longer than twice the height."
      : "The page's claim fails here: the base is longer than twice the height.";
    const above = g.gap < 0.5 ? "S meets T there." : "S is " + Math.round(g.gap) + " above T.";
    return "Base " + Math.round(g.base) + ", height " + Math.round(g.height)
      + ". The product of the three altitudes is " + pct + "% of its biggest value. "
      + peak + " " + verdict + " " + above;
  }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    handles.A.set(state.A);
    handles.B.set(state.B);
    handles.C.set(state.C);
    handles.height.set({ x: Core.LINE_X, y: state.A.y });

    baseLine.set(state.B, state.C).show(true);
    heightLine.set({ x: 0, y: state.A.y }, { x: Core.WIDTH, y: state.A.y }).show(true);
    labels.h.set({ x: Core.LINE_X + 8, y: state.A.y - 7 }).show(state.showNames);

    if (geometry.degenerate) {
      for (const shape of [vertical, circum, circle1, centerDot, midDot, Tdot, Sdot,
        ...radiusMarks, ...hintSegments, ...sideDots, ...hintDots]) shape.show(false);
      for (const name of ["A", "B", "C", "O", "M", "Bm", "Cm", "T", "S"]) labels[name].show(false);
      return;
    }

    const g = geometry;
    circum.set(g.O, g.r).show(true);
    vertical.set(g.Am, g.A0m).show(state.showHint1 || state.showHint2);

    centerDot.set(g.O).show(state.showHint1);
    midDot.set(g.Am).show(true);
    radiusMarks[0].set(g.O, g.Bm).show(state.showHint1);
    radiusMarks[1].set(g.O, g.Cm).show(state.showHint1);
    sideDots[0].set(g.Bm).show(state.showHint1);
    sideDots[1].set(g.Cm).show(state.showHint1);

    circle1.set(g.circle1.center, g.circle1.radius).show(state.showHint2);
    const ends = [[g.T, g.B], [g.T, g.C], [g.S, g.B], [g.S, g.C]];
    for (let i = 0; i < 4; i++) hintSegments[i].set(ends[i][0], ends[i][1]).show(state.showHint2);
    const hintPts = [g.Tb, g.Tc, g.Sb, g.Sc];
    for (let i = 0; i < 4; i++) hintDots[i].set(hintPts[i]).show(state.showHint2);
    Tdot.set(g.T).show(state.showHint2);
    Sdot.set(g.S).show(state.showHint2);

    const spots = {
      A: state.A, B: state.B, C: state.C, O: g.O, Am: g.Am,
      Bm: g.Bm, Cm: g.Cm, T: g.T, S: g.S,
    };
    for (const name of ["A", "B", "C"]) labels[name].set(spots[name]).show(state.showNames);
    labels.M.set(g.Am).show(state.showNames);
    labels.Bm.set(g.Bm).show(state.showNames && state.showHint1);
    labels.Cm.set(g.Cm).show(state.showNames && state.showHint1);
    labels.O.set(g.O).show(state.showNames && state.showHint1);
    labels.T.set(g.T).show(state.showNames && state.showHint2);
    labels.S.set(g.S).show(state.showNames && state.showHint2);
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      for (const name of Core.HANDLES) {
        handles[name].set(name === "height" ? { x: Core.LINE_X, y: state.A.y } : state[name]);
      }
      say("That spot is not allowed.");
      return false;
    }
    state = next;
    render();
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const boxes = {
    showNames: document.getElementById("namesBox"),
    showHint1: document.getElementById("hint1Box"),
    showHint2: document.getElementById("hint2Box"),
  };
  for (const key of Object.keys(boxes)) {
    boxes[key].checked = state[key];
    boxes[key].addEventListener("change", () => {
      apply({ type: "option", key, value: boxes[key].checked },
        boxes[key].checked ? "Showing " + boxes[key].dataset.label + "."
          : "Hid " + boxes[key].dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening triangle.");
  });

  // Colours are CSS classes; a theme flip only needs a redraw of the SVG.
  board.onTheme(() => draw());

  render();
})();
