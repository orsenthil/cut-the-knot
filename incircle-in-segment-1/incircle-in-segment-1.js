"use strict";

/*
 * The page for Incircle In Segment 1: drawing and input only. Every number in
 * the picture comes from incircle-in-segment-1-core.js. The board has three
 * focusable handles: A slides around the big circle to set the horizontal
 * chord, while C and D set where the two inscribed circles touch that chord.
 * The green line is the radical axis; when the circles cross, it goes through
 * their two crossing points and through M. Shapes are created once and only
 * updated, so keyboard focus stays on a handle after every move.
 */

(function () {
  const Core = IncircleInSegment1Core;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const hintChk = document.getElementById("hintChk");
  const resetBtn = document.getElementById("resetBtn");
  const newBtn = document.getElementById("newBtn");
  const board = Geom.board(document.getElementById("board"));

  const baseLayer = board.layer("base");
  const circleLayer = board.layer("circles");
  const axisLayer = board.layer("axis");
  const hintLayer = board.layer("hint");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({});

  /** The shared status line. A demo has no win or loss to announce. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const outer = board.circle(state.center, state.radius, "outer-circle", baseLayer);
  const centre = board.point(state.center, "centre-dot", 3, baseLayer);
  const chord = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "chord", baseLayer);
  const mDot = board.point({ x: 0, y: 0 }, "m-dot", 4, baseLayer);

  const circles = [0, 1].map(() => board.circle(state.center, 1, "incircle", circleLayer));
  const touches = [0, 1].map(() => board.point({ x: 0, y: 0 }, "touch-dot", 3, circleLayer));
  const axis = board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "radical-axis", axisLayer);
  const crossings = [0, 1].map(() => board.point({ x: 0, y: 0 }, "cross-dot", 4, axisLayer));

  const hintCircle = board.circle({ x: 0, y: 0 }, 1, "hint-circle", hintLayer);
  const mToP = [0, 1].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "hint-line", hintLayer));
  const mToQ = [0, 1].map(() => board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "hint-line", hintLayer));
  const mToB = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "hint-line", hintLayer);
  // Up to two hint tangents per incircle, each drawn to M and to its centre.
  const tangents = [0, 1, 2, 3, 4, 5, 6, 7].map(() =>
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent-line", hintLayer));

  const names = ["A", "B", "C", "D", "M", "U", "V"];
  const offsets = {
    A: [-12, -8], B: [7, -8], C: [-5, -12], D: [7, -12],
    M: [7, 15], U: [7, -8], V: [7, 15],
  };
  const labels = names.map((n) =>
    board.label({ x: 0, y: 0 }, n, "point-label", offsets[n][0], offsets[n][1], labelLayer));

  /** Keep A on the circle, away from the collapsed-chord positions. */
  function clampA(q) {
    const O = state.center;
    const angle = Core.clampAngle(Math.atan2(-(q.y - O.y), q.x - O.x));
    return {
      x: O.x + state.radius * Math.cos(angle),
      y: O.y - state.radius * Math.sin(angle),
    };
  }

  /** Keep a chord contact between A and B, as the applet's AdjustPoint does. */
  function clampChord(q) {
    const h = Core.handles(state);
    return Core.adjust(q, h.A, h.B);
  }

  const handles = {
    A: board.handle("A", { x: 0, y: 0 }, {
      r: 8, step: 3, shift: 12, cls: "geom-handle a-handle", layer: handleLayer,
      label: "Chord endpoint A. Drag it, or focus it and use the arrow keys, to turn the chord.",
      clamp: clampA,
      onMove: (p) => {
        state = Core.move(state, { type: "point", name: "A", x: p.x, y: p.y });
        render();
      },
    }),
    C: board.handle("C", { x: 0, y: 0 }, {
      r: 8, step: 2, shift: 10, layer: handleLayer,
      label: "Circle touch point C. Drag it, or focus it and use the arrow keys, along the chord.",
      clamp: clampChord,
      onMove: (p) => {
        state = Core.move(state, { type: "point", name: "C", x: p.x, y: p.y });
        render();
      },
    }),
    D: board.handle("D", { x: 0, y: 0 }, {
      r: 8, step: 2, shift: 10, layer: handleLayer,
      label: "Circle touch point D. Drag it, or focus it and use the arrow keys, along the chord.",
      clamp: clampChord,
      onMove: (p) => {
        state = Core.move(state, { type: "point", name: "D", x: p.x, y: p.y });
        render();
      },
    }),
  };

  function render() {
    const h = Core.handles(state);
    const g = Core.geometry(state);

    outer.set(h.O, state.radius);
    centre.set(h.O);
    chord.set(h.A, h.B);
    mDot.set(h.M);

    for (let i = 0; i < 2; i++) {
      const ok = !g.degenerate && !!g.circles[i];
      const c = ok ? g.circles[i] : null;
      circles[i].show(ok).set(c ? c.center : h.O, c ? c.radius : 1);
      touches[i].show(ok).set(c ? c.Q : h.O);
      mToP[i].show(state.hint && ok).set(h.M, c ? c.P : h.M);
      mToQ[i].show(state.hint && ok).set(h.M, c ? c.Q : h.M);
    }

    const hasAxis = !g.degenerate && !!g.radicalLine;
    axis.show(hasAxis).set(
      hasAxis ? g.radicalLine.p : h.M,
      hasAxis ? g.radicalLine.q : h.M,
    );
    for (let i = 0; i < 2; i++) {
      const u = g.intersections[i];
      crossings[i].show(!!u).set(u || h.M);
    }

    // Hint: the circle about M through A, the tangents from its crossings
    // with each incircle, and the lines M-P, M-Q and M-B the applet draws.
    hintCircle.show(state.hint && !g.degenerate).set(h.M, g.mt);
    mToB.show(state.hint && !g.degenerate).set(h.M, h.B);
    let t = 0;
    if (state.hint && !g.degenerate) {
      for (let i = 0; i < 2 && t < tangents.length; i++) {
        const c = g.circles[i];
        const pts = Geom.circleIntersection(h.M, g.mt, c.center, c.radius);
        for (const p of pts) {
          if (t + 1 >= tangents.length) break;
          tangents[t++].show(true).set(p, h.M);
          tangents[t++].show(true).set(p, c.center);
        }
      }
    }
    for (let i = t; i < tangents.length; i++) tangents[i].show(false);

    const shown = {
      A: h.A, B: h.B, C: h.C, D: h.D, M: h.M,
      U: g.intersections[0], V: g.intersections[1],
    };
    for (let i = 0; i < names.length; i++) {
      const p = shown[names[i]];
      labels[i].show(!!p).set(p || h.O, names[i]);
    }
    handles.A.set(h.A);
    handles.C.set(h.C);
    handles.D.set(h.D);

    say(Core.describe(state));
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  hintChk.addEventListener("change", () => {
    state = Core.move(state, { type: "hint", value: hintChk.checked });
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "reset" });
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "new" });
    render();
  });

  board.onTheme(() => render());
  render();
})();
