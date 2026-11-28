"use strict";

/*
 * The page for Max Common Chord: drawing and input only. All the geometry is
 * in max-common-chord-core.js. The board holds four draggable points P, Q, A,
 * B, their two circles, the chord AB, the circumcircle ABQ, the point R on the
 * radical axis PQ and (when it exists) the tangent chord At-Bt. Shapes are
 * created once and updated in place, so keyboard focus survives a redraw.
 */

(function () {
  const Core = MaxCommonChordCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));
  const circlesBtn = document.getElementById("circlesBtn");
  const chordBtn = document.getElementById("chordBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const newBtn = document.getElementById("newBtn");

  const circleLayer = board.layer("circles");
  const guideLayer = board.layer("guides");
  const chordLayer = board.layer("chord");
  const hintLayer = board.layer("hint");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({});
  let shown = Core.compute(state);
  let showNames = false;
  let showHint = false;

  const circleE = board.circle({ x: 0, y: 0 }, 1, "ring ring-E", circleLayer);
  const circleF = board.circle({ x: 0, y: 0 }, 1, "ring ring-F", circleLayer);
  const circleABQ = board.circle({ x: 0, y: 0 }, 1, "ring ring-ABQ", circleLayer);
  const radical = board.line({ x: 0, y: 0 }, { x: 0, y: 1 }, "radical-axis", guideLayer);
  const abLine = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "chord-AB", chordLayer);
  const tangentChord = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent-chord", guideLayer);
  const tangents = [0, 1].map(() =>
    board.line({ x: 0, y: 0 }, { x: 1, y: 0 }, "tangent-line", hintLayer));
  const rightAngles = [0, 1].map(() =>
    board.rightAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, 14,
      "right-angle", hintLayer));
  const marks = ["R", "At", "Bt", "Pe", "Pf"].map((name) =>
    board.point({ x: 0, y: 0 }, "mark mark-" + name, name === "R" ? 6 : 5, markLayer));
  const labels = ["P", "Q", "A", "B", "R", "E", "F", "At", "Bt"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", 12, -12, labelLayer));

  const finite = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const fitCircle = (c) => !!c && finite(c.center) && Number.isFinite(c.radius) &&
    c.radius > 0 && c.radius < 3000;

  /** Say what the picture shows. This illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function makeHandle(name) {
    return board.handle(name, { x: state[name].x, y: state[name].y }, {
      r: 15, step: 4, shift: 20, layer: handleLayer,
      label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it",
      describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y),
      clamp: (p) => ({
        x: Geom.clamp(p.x, 8, state.width - 8),
        y: Geom.clamp(p.y, 8, state.height - 8),
      }),
      onMove: (point) => {
        state = Core.movePoint(state, name, point);
        render();
      },
    });
  }

  const handles = {
    P: makeHandle("P"), Q: makeHandle("Q"), A: makeHandle("A"), B: makeHandle("B"),
  };

  function message(info) {
    if (!info.valid) {
      return info.reason === "collinear"
        ? "Three points are almost in one line, so no circle can be drawn. Move P, Q, A or B."
        : "Two of the points are almost on top of each other, so the circles cannot be drawn. Move P, Q, A or B apart.";
    }
    const value = Number.isFinite(info.product) ? info.product.toFixed(1) : "?";
    if (info.inside) {
      return "R lies between P and Q, so there are no tangents to draw. Move A or B until R leaves the gap between P and Q.";
    }
    if (!info.onChord) {
      return "A, P and B are not in one straight line. Choose Adjust chord and drag A or B, or move P onto the chord. AP × PB = " + value + ".";
    }
    if (info.between) {
      return "At, P and Bt are in one line: this is the longest chord. AP × PB = PQ × PR = " + value + ".";
    }
    return "AP × PB = PQ × PR = " + value + ". Move A or B to make PR longer: the longest chord has At, P and Bt in one line.";
  }

  function setCircle(shape, c) {
    const ok = fitCircle(c);
    shape.show(ok);
    if (ok) shape.set(c.center, c.radius);
  }

  function setLine(shape, ends) {
    const ok = ends && finite(ends.p) && finite(ends.q);
    shape.show(ok);
    if (ok) shape.set(ends.p, ends.q);
  }

  function render() {
    shown = Core.compute(state);
    const info = shown;

    setCircle(circleE, info.E);
    setCircle(circleF, info.F);
    setCircle(circleABQ, info.ABQ);
    setLine(radical, info.valid ? { p: state.P, q: state.Q } : null);
    setLine(abLine, { p: state.A, q: state.B });
    setLine(tangentChord, info.tangent);
    setLine(tangents[0], info.RA);
    setLine(tangents[1], info.RB);

    const tangency = [info.At, info.Bt, info.Pe, info.Pf];
    for (let i = 0; i < marks.length; i++) {
      const p = i === 0 ? info.R : tangency[i - 1];
      const visible = finite(p) && (i === 0 || (i <= 2 ? true : showHint));
      marks[i].show(visible);
      if (visible) marks[i].set(p);
    }

    const atPairs = [[info.At, info.E && info.E.center], [info.Bt, info.F && info.F.center]];
    for (let i = 0; i < 2; i++) {
      const p = atPairs[i][0], c = atPairs[i][1];
      const ok = showHint && finite(p) && finite(c) && finite(info.R);
      rightAngles[i].show(ok);
      if (ok) rightAngles[i].set(p, c, info.R, 14);
    }

    const labelPoints = [state.P, state.Q, state.A, state.B, info.R,
      info.E && info.E.center, info.F && info.F.center, info.At, info.Bt];
    for (let i = 0; i < labels.length; i++) {
      const p = labelPoints[i];
      const ok = showNames && finite(p) && (i < 7 || showHint);
      labels[i].show(ok);
      if (ok) labels[i].set(p);
    }

    for (const name of ["P", "Q", "A", "B"]) handles[name].set(state[name]);
    say(message(info));

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state, info));
  }

  function setMode(mode) {
    state = Core.setMode(state, mode);
    chordBtn.setAttribute("aria-pressed", String(mode === "chord"));
    circlesBtn.setAttribute("aria-pressed", String(mode === "circles"));
    render();
  }

  chordBtn.addEventListener("click", () => setMode("chord"));
  circlesBtn.addEventListener("click", () => setMode("circles"));

  namesBtn.addEventListener("click", () => {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    render();
  });

  hintBtn.addEventListener("click", () => {
    showHint = !showHint;
    hintBtn.setAttribute("aria-pressed", String(showHint));
    render();
  });

  newBtn.addEventListener("click", () => {
    state = Core.start({ width: state.width, height: state.height, mode: state.mode });
    render();
  });

  board.onTheme(() => render());
  render();
})();
