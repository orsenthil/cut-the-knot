"use strict";

/*
 * Common Tangent Sangaku: the page's drawing and input only. All the geometry
 * lives in common-tangent-sangaku-core.js. The board has three focusable
 * handles: C is the angle's vertex, O the big circle's centre, and Q the small
 * circle's centre, constrained to the segment C..O. Shapes are created once
 * and moved in place, so a handle keeps its keyboard focus across a redraw.
 */

(function () {
  const Core = CommonTangentSangakuCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const namesChk = document.getElementById("namesChk");
  const statementChk = document.getElementById("statementChk");
  const hintChk = document.getElementById("hintChk");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const circlesLayer = board.layer("circles");
  const chordLayer = board.layer("chord");
  const hintLayer = board.layer("hint");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({
    showNames: namesChk.checked,
    showStatement: statementChk.checked,
    showHint: hintChk.checked,
  });

  /**
   * The shared status line. "done" tells the player's record that this
   * illustration has been explored; there is no win and no loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const origin = { x: 0, y: 0 };
  const sideUp = board.line(origin, { x: 1, y: 0 }, "side", guides);
  const sideDown = board.line(origin, { x: 1, y: 0 }, "side", guides);
  const bisector = board.line(origin, { x: 1, y: 0 }, "bisector", guides);
  const circleO = board.circle(origin, 1, "circle-o", circlesLayer);
  const circleQ = board.circle(origin, 1, "circle-q", circlesLayer);
  const chord = board.segment(origin, { x: 1, y: 0 }, "chord", chordLayer);
  const chordMark = board.rightAngle(origin, { x: 1, y: 0 }, { x: 0, y: 1 }, 8, "right-mark", chordLayer);

  const outerTangent = board.line(origin, { x: 1, y: 0 }, "hint-line", hintLayer);
  const bigTriangleA = board.segment(origin, { x: 1, y: 0 }, "hint-line", hintLayer);
  const bigTriangleB = board.segment(origin, { x: 1, y: 0 }, "hint-line", hintLayer);
  const hintMarkM = board.rightAngle(origin, { x: 1, y: 0 }, { x: 0, y: 1 }, 9, "hint-mark", hintLayer);
  const hintMarkV = board.rightAngle(origin, { x: 1, y: 0 }, { x: 0, y: 1 }, 9, "hint-mark", hintLayer);
  const hintMarkQ = board.rightAngle(origin, { x: 1, y: 0 }, { x: 0, y: 1 }, 9, "hint-mark", hintLayer);
  const hintChordM = board.segment(origin, { x: 1, y: 0 }, "hint-solid", hintLayer);
  const hintChordN = board.segment(origin, { x: 1, y: 0 }, "hint-solid", hintLayer);
  const hintShapes = [outerTangent, bigTriangleA, bigTriangleB, hintMarkM, hintMarkV,
    hintMarkQ, hintChordM, hintChordN];

  // Yellow points are what the applet's "Show statement" option switches on.
  const statementDots = {};
  ["M", "N", "P", "Q"].forEach((name) => {
    statementDots[name] = board.point(origin, "statement-dot", 5, chordLayer);
  });

  const labelNames = ["C", "O", "Q", "M", "N", "P", "S", "T", "U", "V", "W"];
  const labels = {};
  labelNames.forEach((name) => {
    labels[name] = board.label(origin, name, "point-label", 6, -7, labelsLayer);
  });

  function boardPoint(p) {
    const m = 12;
    return { x: Core.clamp(p.x, m, state.width - m), y: Core.clamp(p.y, m, state.height - m) };
  }

  const handles = {
    C: board.handle("C", state.C, {
      r: 7, step: 3, shift: 15, cls: "geom-handle handle-c", layer: handlesLayer,
      label: "Point C, the angle's vertex. Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "At board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: boardPoint,
      onMove: (point) => {
        state = Core.movePoint(state, "C", point);
        render();
      },
    }),
    O: board.handle("O", state.O, {
      r: 7, step: 3, shift: 15, cls: "geom-handle handle-o", layer: handlesLayer,
      label: "Point O, centre of the big circle. Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "At board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: boardPoint,
      onMove: (point) => {
        state = Core.movePoint(state, "O", point);
        render();
      },
    }),
    Q: board.handle("Q", state.Q, {
      r: 7, step: 3, shift: 15, cls: "geom-handle handle-q", layer: handlesLayer,
      label: "Point Q, centre of the small circle. Drag it, or focus it and use the arrow keys to slide it between C and O.",
      describe: (p) => "At board position " + Math.round(p.x) + ", " + Math.round(p.y) +
        ", " + Math.round(Core.parameterOnSegment(p, state.C, state.O) * 100) + " percent of the way from C to O.",
      clamp: (p) => Core.lerp(state.C, state.O, Core.parameterOnSegment(p, state.C, state.O)),
      onMove: (point) => {
        state = Core.movePoint(state, "Q", point);
        render();
      },
    }),
  };

  function extendThrough(from, to, times) {
    return { x: from.x + (to.x - from.x) * times, y: from.y + (to.y - from.y) * times };
  }

  function render() {
    const g = Core.geometry(state);
    const diagram = !!g;
    [sideUp, sideDown, bisector, circleO, circleQ, chord, chordMark].forEach((s) => s.show(diagram));
    hintShapes.forEach((s) => s.show(diagram && state.showHint));
    labelNames.forEach((name) => labels[name].show(diagram && state.showNames));
    ["M", "N", "P", "Q"].forEach((name) => statementDots[name].show(diagram && state.showStatement));

    if (diagram) {
      // The two angle sides are the rays from C through the tangency points.
      sideUp.set(state.C, extendThrough(state.C, g.M, 4));
      sideDown.set(state.C, extendThrough(state.C, g.N, 4));
      bisector.set(state.C, extendThrough(state.C, state.O, 4));
      circleO.set(state.O, g.R);
      circleQ.set(state.Q, g.r);
      chord.set(g.M, g.N);
      chordMark.set(g.P, state.O, g.M, 8);

      const dots = { M: g.M, N: g.N, P: g.P, Q: state.Q };
      ["M", "N", "P", "Q"].forEach((name) => statementDots[name].set(dots[name]));
      const pts = {
        C: state.C, O: state.O, Q: state.Q, M: g.M, N: g.N, P: g.P,
        S: g.S, T: g.T, U: g.U, V: g.V, W: g.W,
      };
      labelNames.forEach((name) => {
        const p = pts[name];
        if (p && Number.isFinite(p.x)) labels[name].set(p);
      });

      if (state.showHint && g.U && g.W && Number.isFinite(g.U.x) && Number.isFinite(g.W.x)) {
        outerTangent.set(g.V, extendThrough(g.V, g.U, 2));
        bigTriangleA.set(state.C, g.U);
        bigTriangleB.set(state.C, g.W);
        hintMarkM.set(g.M, state.O, state.C, 9);
        hintMarkV.set(g.V, state.C, g.U, 9);
        hintMarkQ.set(g.S, state.Q, g.M, 9);
        hintChordM.set(g.M, g.S);
        hintChordN.set(g.N, g.T);
      } else {
        hintShapes.forEach((s) => s.show(false));
      }

      say("Big circle radius " + g.R.toFixed(1) + ", small circle radius " + g.r.toFixed(1) +
        ". CQ = " + Core.distance(state.C, state.Q).toFixed(1) + ", CO = " + g.d.toFixed(1) +
        ": the small circle touches chord MN and its centre lies on the big circle.", "done");
    } else {
      say("Move Q at least 2 board units from C to draw both circles.", "done");
    }

    handles.C.set(state.C);
    handles.O.set(state.O);
    handles.Q.set(state.Q);

    // The plain position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  namesChk.addEventListener("change", () => {
    state = { ...state, showNames: namesChk.checked };
    render();
  });
  statementChk.addEventListener("change", () => {
    state = { ...state, showStatement: statementChk.checked };
    render();
  });
  hintChk.addEventListener("change", () => {
    state = { ...state, showHint: hintChk.checked };
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });
  board.onTheme(() => render());
  render();
})();
