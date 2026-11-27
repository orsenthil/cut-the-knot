"use strict";

/*
 * The page for Eves Extension: drawing and input only. The geometry is in
 * eves-extension-core.js. Every blue tangency point and the red start point is
 * a focusable handle, so a player can drag with a pointer or nudge with the
 * arrow keys. Shapes are created once and changed in place, so a handle keeps
 * its keyboard focus after each redraw.
 */

(function () {
  const Core = EvesExtensionCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const minusBtn = document.getElementById("minusBtn");
  const plusBtn = document.getElementById("plusBtn");
  const resetBtn = document.getElementById("resetBtn");
  const tangencyBtn = document.getElementById("tangencyBtn");
  const board = Geom.board(document.getElementById("board"));

  const guidesLayer = board.layer("guides");
  const tangentLayer = board.layer("tangents");
  const sidesLayer = board.layer("sides");
  const loopsLayer = board.layer("loops");
  const handlesLayer = board.layer("handles");

  let state = Core.start({ n: Number(nInput.value) });

  const circleShape = board.circle(state.start, 1, "incircle", guidesLayer);
  const tangents = [];
  const sides = [];
  const corners = [];
  const firsts = [];
  const seconds = [];
  for (let i = 0; i < Core.N_MAX; i++) {
    tangents.push(board.line(state.start, state.start, "tangent", tangentLayer));
    sides.push(board.segment(state.start, state.start, "side", sidesLayer));
    corners.push(board.point(state.start, "corner-dot", 3, loopsLayer));
    firsts.push(board.point(state.start, "first-dot", 5, loopsLayer));
    seconds.push(board.point(state.start, "second-dot", 5, loopsLayer));
  }
  const startDot = board.point(state.start, "start-dot", 6, loopsLayer);

  /** The shared status line. This picture has no win or loss to announce. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Tangency points are kept on the circle, as in the applet. */
  function clampToCircle(q) {
    const circle = Core.circleFor(state.points);
    const d = Core.sub(q, circle.center);
    const length = Math.sqrt(Core.sqDist(d, Core.point(0, 0)));
    if (length === 0) return { x: q.x, y: q.y };
    return Core.add(circle.center, Core.mul(d, circle.radius / length));
  }

  const pointHandles = [];
  for (let i = 0; i < Core.N_MAX; i++) {
    const index = i;
    pointHandles.push(board.handle("P" + (i + 1), state.points[i] || state.start, {
      r: 10, step: 4, shift: 16, cls: "geom-handle point-handle",
      layer: handlesLayer, clamp: clampToCircle,
      label: "Tangency point " + (i + 1) + " on the circle. Drag it, or focus it and use the arrow keys.",
      onMove: (p) => {
        state = Core.movePoint(state, index, p);
        render();
      },
    }));
  }
  const startHandle = board.handle("Start", state.start, {
    r: 11, step: 4, shift: 16, cls: "geom-handle start-handle",
    layer: handlesLayer,
    label: "Red start point. Drag it anywhere on the board, or focus it and use the arrow keys.",
    clamp: (q) => Core.point(Geom.clamp(q.x, 8, state.width - 8),
      Geom.clamp(q.y, 8, state.height - 8)),
    onMove: (p) => {
      state = Core.setStart(state, p);
      render();
    },
  });

  function render() {
    const d = Core.compute(state);
    const n = state.n;

    circleShape.set(d.circle.center, d.circle.radius);
    for (let i = 0; i < n; i++) {
      const line = d.lines[i];
      tangents[i].set(line[0], line[1]);
      sides[i].set(d.V[i], d.V[(i + 1) % n]);
      corners[i].set(d.V[i]);
      firsts[i].set(d.F[i]);
      seconds[i].set(d.G[i]);
      pointHandles[i].set(state.points[i]);
    }
    for (let i = n; i < Core.N_MAX; i++) {
      tangents[i].show(false);
      sides[i].show(false);
      corners[i].show(false);
      firsts[i].show(false);
      seconds[i].show(false);
      pointHandles[i].show(false);
    }
    for (let i = 0; i < n; i++) {
      tangents[i].show(true);
      sides[i].show(true);
      corners[i].show(true);
      firsts[i].show(true);
      // The applet draws the second loop only for an even polygon.
      seconds[i].show(n % 2 === 0);
      pointHandles[i].show(true);
    }
    startDot.set(state.start);
    startHandle.set(state.start);

    const parity = n % 2 === 0 ? "even" : "odd";
    const same = d.gap < 1e-6;
    let message = n + " sides, an " + parity + " polygon. ";
    if (n % 2 === 0) {
      message += "The second loop repeats the first: the largest gap is " +
        d.gap.toExponential(1) + " board units. Odd-side and even-side sums differ by " +
        d.alternating.toExponential(1) + ".";
    } else if (same) {
      message += "The start is on a tangency point, so the two loops meet.";
    } else {
      message += "The two loops are " + d.gap.toFixed(1) +
        " board units apart; press Start on a tangency point to close them.";
    }
    say(message);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function setCount(n) {
    const value = Geom.clamp(Math.round(n), Core.N_MIN, Core.N_MAX);
    nInput.value = String(value);
    state = Core.setCount(state, value);
    render();
  }

  minusBtn.addEventListener("click", () => setCount(state.n - 1));
  plusBtn.addEventListener("click", () => setCount(state.n + 1));
  nInput.addEventListener("change", () => setCount(Number(nInput.value)));
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });
  tangencyBtn.addEventListener("click", () => {
    state = Core.startAtTangency(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
