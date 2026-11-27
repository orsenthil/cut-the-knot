"use strict";

/*
 * The page for Fixed Tangent Point: drawing and input only. All geometry is in
 * fixed-tangent-point-core.js. The SVG holds the fixed circle C, the line m
 * (through X and P), the circle centred at P through the tangency point T,
 * and the point Q that every such circle passes through. Four handles let a
 * player move O, R, X and P; the buttons switch the applet's three overlays.
 */

(function () {
  const Core = FixedTangentPointCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const statementBtn = document.getElementById("statementBtn");
  const board = Geom.board(document.getElementById("board"));

  const guideLayer = board.layer("guides");
  const circleLayer = board.layer("circles");
  const hintLayer = board.layer("hints");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({ width: 480, height: 360 });
  let shown = Core.compute(state, null);

  const lineM = board.line({ x: 0, y: 0 }, { x: 480, y: 0 }, "line-m", guideLayer);
  const radius = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "radius", guideLayer);
  const circleC = board.circle({ x: 0, y: 0 }, 1, "circle-c", circleLayer);
  const circleP = board.circle({ x: 0, y: 0 }, 1, "circle-tangent", circleLayer);

  const hintLines = [0, 1, 2, 3, 4, 5, 6].map(() =>
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "hint-line", hintLayer));
  const hintAngles = [0, 1, 2].map(() =>
    board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 11,
      "right-mark", hintLayer));
  const statementLines = [0, 1, 2, 3].map(() =>
    board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "statement-line", hintLayer));
  const statementAngles = [0, 1].map(() =>
    board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 11,
      "right-mark", hintLayer));

  const qDot = board.point({ x: 0, y: 0 }, "fixed-point", 5, markLayer);
  const statementDot = board.point({ x: 0, y: 0 }, "statement-dot", 6, markLayer);
  const nDot = board.point({ x: 0, y: 0 }, "tangent-dot", 4, markLayer);
  const tDots = [0, 1].map(() => board.point({ x: 0, y: 0 }, "tangent-dot", 4, markLayer));
  const labels = ["O", "P", "M", "N", "T", "Q"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", 9, -9, labelLayer));

  /**
   * Shows a line under the picture. `kind` is "win", "lose", "done" or
   * nothing; this illustration has no end, so no kind is ever used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (n) => (Math.round(n * 100) / 100).toFixed(2);

  /** A clamp for X: the applet fixes its x, so it only slides vertically. */
  function clampX(q) {
    return { x: state.X.x, y: Geom.clamp(q.y, 8, state.height - 8) };
  }
  /** A clamp for P: it slides along m, never off it. */
  function clampP(q) {
    return { x: Geom.clamp(q.x, 8, state.width - 8), y: state.X.y };
  }
  /** A clamp for the centre and the rim point. */
  function clampFree(q) {
    return {
      x: Geom.clamp(q.x, 8, state.width - 8),
      y: Geom.clamp(q.y, 8, state.height - 8),
    };
  }
  function spoken(p) {
    return "at " + Math.round(p.x) + ", " + Math.round(p.y) + " in board units";
  }

  function onMove(point, name) {
    state = Core.movePoint(state, name, point);
    render();
  }

  const handles = {
    O: board.handle("O", state.O, {
      r: 8, step: 2, shift: 10, layer: handleLayer, clamp: clampFree, onMove,
      label: "Centre O of the circle. Drag it, or focus it and use the arrow keys to move it",
      describe: spoken,
    }),
    R: board.handle("R", state.R, {
      r: 8, step: 2, shift: 10, layer: handleLayer, clamp: clampFree, onMove,
      label: "Rim point R of the circle. Drag it to change the radius, or use the arrow keys",
      describe: spoken,
    }),
    X: board.handle("X", state.X, {
      r: 8, step: 2, shift: 10, layer: handleLayer, clamp: clampX, onMove,
      label: "Line point X. Drag it up or down to move the line, or use the arrow keys",
      describe: spoken,
    }),
    P: board.handle("P", state.P, {
      r: 8, step: 2, shift: 10, layer: handleLayer, clamp: clampP, onMove,
      label: "Point P on the line. Drag it along the line, or use the left and right arrow keys",
      describe: spoken,
    }),
  };

  function showShape(shape, on) {
    shape.show(!!on);
    return shape;
  }

  /** Sets a segment from two points only when it will be visible. */
  function setSegment(shape, p, q, on) {
    if (on) shape.set(p, q);
    showShape(shape, on);
  }

  function render() {
    shown = Core.compute(state, shown);
    const opts = state.options;
    const valid = !shown.noDraw && !shown.noDot && !!shown.Q && !!shown.N;
    const withHint = !!opts.hint && valid;
    const withStatement = !!opts.statement && valid;

    lineM.set({ x: 0, y: state.X.y }, { x: state.width, y: state.X.y });
    radius.set(state.O, state.R);
    circleC.set(state.O, shown.radius);

    showShape(circleP, !shown.noDraw && !!shown.tangentCircle);
    if (!shown.noDraw && shown.tangentCircle) {
      circleP.set(shown.tangentCircle.center, shown.tangentCircle.radius);
    }

    const h = [];
    if (shown.M) h.push([state.O, state.P], [state.O, shown.M]);
    if (valid) h.push([shown.Q, state.P], [shown.M, shown.N], [state.O, shown.N],
      [state.P, shown.T[0]], [state.O, shown.T[0]]);
    for (let i = 0; i < hintLines.length; i++) {
      setSegment(hintLines[i], h[i] && h[i][0], h[i] && h[i][1], withHint && !!h[i]);
    }
    const corners = [];
    if (shown.M) corners.push([shown.M, state.P, state.O]);
    if (valid) corners.push([shown.N, shown.M, state.O], [shown.T[0], state.P, state.O]);
    for (let i = 0; i < hintAngles.length; i++) {
      const c = corners[i];
      if (withHint && c) hintAngles[i].set(c[0], c[1], c[2], 11);
      showShape(hintAngles[i], withHint && !!c);
    }

    if (valid) {
      const s = [
        [state.P, shown.T[0]], [state.P, shown.T[1]],
        [state.O, shown.T[0]], [state.O, shown.T[1]],
      ];
      for (let i = 0; i < statementLines.length; i++) {
        setSegment(statementLines[i], s[i][0], s[i][1], withStatement);
      }
      const cornersS = [[shown.T[0], state.P, state.O], [shown.T[1], state.P, state.O]];
      for (let i = 0; i < statementAngles.length; i++) {
        if (withStatement) statementAngles[i].set(cornersS[i][0], cornersS[i][1], cornersS[i][2], 11);
        showShape(statementAngles[i], withStatement);
      }
    } else {
      statementLines.forEach((shape) => showShape(shape, false));
      statementAngles.forEach((shape) => showShape(shape, false));
    }

    showShape(qDot, valid);
    if (valid) qDot.set(shown.Q);
    showShape(statementDot, withStatement);
    if (withStatement) statementDot.set(shown.Q);
    showShape(nDot, withHint);
    if (withHint) nDot.set(shown.N);
    for (let i = 0; i < tDots.length; i++) {
      showShape(tDots[i], withHint && !!shown.T[i]);
      if (withHint && shown.T[i]) tDots[i].set(shown.T[i]);
    }

    const nameList = [state.O, state.P, shown.M, shown.N, shown.T && shown.T[0], shown.Q];
    const nameOn = [
      !!opts.names, !!opts.names, !!opts.names && !!opts.hint && !shown.noDraw,
      !!opts.names && withHint, !!opts.names && withHint, !!opts.names && valid,
    ];
    for (let i = 0; i < labels.length; i++) {
      if (nameList[i] && nameOn[i]) labels[i].set(nameList[i]);
      showShape(labels[i], !!nameList[i] && nameOn[i]);
    }

    for (const name of Object.keys(handles)) handles[name].set(state[name]);

    if (shown.noDraw) {
      say("P is inside the circle. Move it or the centre until the line misses the circle.");
    } else if (shown.noDot) {
      say("The line cuts the circle. Move X until the line clears it, then Q appears again.");
    } else {
      say("PQ = " + fmt(shown.pq) + " and PT = " + fmt(shown.tangentLength) +
        ". Slide P: the point Q stays where it is.");
    }

    // The position, in board units, for the player's record and the tutor.
    const trackState = Core.position(state, shown);
    if (window.Track) window.Track.state(trackState);
  }

  function setButton(button, name) {
    button.addEventListener("click", () => {
      state = Core.setOption(state, name, !state.options[name]);
      button.setAttribute("aria-pressed", String(state.options[name]));
      render();
    });
    button.setAttribute("aria-pressed", String(state.options[name]));
  }

  newBtn.addEventListener("click", () => {
    state = Core.reset(state);
    shown = Core.compute(state, null);
    render();
  });
  setButton(namesBtn, "names");
  setButton(hintBtn, "hint");
  setButton(statementBtn, "statement");

  board.onTheme(() => render());
  render();
})();
