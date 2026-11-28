"use strict";

/*
 * The page for Line, Circle, and Fixed Points: drawing and input only. All the
 * geometry lives in line-circle-and-fixed-points-core.js. An SVG board holds
 * the given circle C(O), the line through Q and V, the circle through P, Q, V,
 * the line VR and — with the check boxes — the fixed point S and the tangent
 * circle PQV'. Four focusable Geom handles move P, Q, V and O with a pointer
 * or the arrow keys; Reset brings back the opening picture.
 */

(function () {
  const Core = LineCircleAndFixedPointsCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    lines: board.layer("lines"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** The status line. "done" is how a demo tells the player's record it was
   *  explored; render() sets it from Core.result(). */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Shapes are made once and re-set on every redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const circleO = board.circle(state.O, 1, "circle-o", layers.circles);
  const circleX = board.circle(state.P, 1, "circle-x", layers.circles);
  const circleT = board.circle(state.P, 1, "circle-t", layers.circles);
  const givenLine = board.line(state.Q, state.V, "given-line", layers.lines);
  const vrLine = board.line(state.V, state.P, "vr-line", layers.lines);
  const spLine = board.line(state.P, state.V, "sp-line", layers.lines);

  const pDot = board.point(state.P, "fixed-dot", 5.5, layers.dots);
  const qDot = board.point(state.Q, "fixed-dot", 5.5, layers.dots);
  const oDot = board.point(state.O, "center-dot", 4.5, layers.dots);
  const rDot = board.point(state.P, "r-dot", 5.5, layers.dots);
  const sDot = board.point(state.P, "s-dot", 6, layers.dots);
  const tDot = board.point(state.P, "t-dot", 5, layers.dots);

  const labelOffsets = {
    P: [-10, -12], Q: [9, -11], V: [-11, -11], O: [-11, -10],
    R: [9, -8], S: [9, -8], T: [9, 17],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.P, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  function statusText() {
    if (!geometry || !geometry.circleT) {
      return "Move the points so the circle through P, Q and V meets the given circle again.";
    }
    const g = geometry;
    const gap = g.fixedError;
    const fixed = gap < 0.05
      ? "VR goes through the fixed point S."
      : "VR is close to the fixed point S (gap " + Math.round(gap) + ").";
    const tangent = g.tangency < 0.05
      ? "The circle through P, Q and V' touches the given circle at P."
      : "The circle through P, Q and V' is almost tangent at P.";
    return "R is where the two circles meet again; S is where VR returns to the given circle. "
      + fixed + " " + tangent;
  }

  function draw() {
    geometry = Core.compute(state);
    handles.P.set(state.P);
    handles.Q.set(state.Q);
    handles.V.set(state.V);
    handles.O.set(state.O);
    pDot.set(state.P);
    qDot.set(state.Q);
    oDot.set(state.O);
    givenLine.set(state.Q, state.V).show(true);
    circleO.set(state.O, geometry ? geometry.circleO.radius : 40).show(true);
    circleX.set(state.P, 40).show(false);
    circleT.set(state.P, 40).show(false);
    vrLine.set(state.V, state.P).show(false);
    spLine.set(state.P, state.V).show(false);
    rDot.set(state.P).show(false);
    sDot.set(state.P).show(false);
    tDot.set(state.P).show(false);
    for (const name of Object.keys(labels)) labels[name].show(false);

    if (!geometry || !geometry.circleT) return;
    const g = geometry;
    circleX.set(g.circleX.center, g.circleX.radius).show(true);
    vrLine.set(g.V, g.R).show(true);
    rDot.set(g.R).show(true);
    sDot.set(g.S).show(state.showStatement);
    spLine.set(g.S, g.P).show(state.showHint);
    tDot.set(g.T).show(state.showHint);
    circleT.set(g.circleT.center, g.circleT.radius).show(state.showHint);

    const spots = { P: state.P, Q: state.Q, V: state.V, O: state.O,
      R: g.R, S: g.S, T: g.T };
    for (const name of ["P", "Q", "V", "O", "R"]) {
      labels[name].set(spots[name]).show(state.showNames);
    }
    labels.S.set(g.S).show(state.showNames && state.showStatement);
    labels.T.set(g.T).show(state.showNames && state.showHint);
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
      for (const name of Core.HANDLES) handles[name].set(state[name]);
      say("That spot is not allowed.");
      return false;
    }
    state = next;
    render();
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const notes = {
    P: "Moved P on the given circle.",
    Q: "Moved Q on the given line.",
    V: "Moved V along the given line.",
    O: "Moved the circle's centre O.",
  };
  const handles = {};
  for (const name of Core.HANDLES) {
    const description = "Point " + name + ". Drag it, or focus it and use the arrow keys"
      + (name === "V" ? " to move it along the line" : "") + ".";
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 4,
      label: description,
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => Core.clampHandle(which, q, state),
      onMove: (p, which) => apply({ type: "point", name: which, point: p }, notes[which]),
    });
  }

  const boxes = {
    showNames: document.getElementById("namesBox"),
    showPremise: document.getElementById("premiseBox"),
    showStatement: document.getElementById("statementBox"),
    showHint: document.getElementById("hintBox"),
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
    apply({ type: "reset" }, "Back to the opening picture.");
  });

  // Colours are CSS classes; a theme flip only needs a redraw of the SVG.
  board.onTheme(() => draw());

  render();
})();
