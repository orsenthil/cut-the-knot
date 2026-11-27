"use strict";

/*
 * The page for Eppstein: drawing and input only. All the geometry is in
 * eppstein-core.js. The board has three focusable corner handles A, B, C;
 * the three vertex circles, the chosen Soddy circle and the three joins are
 * made once and then set() on every redraw, so keyboard focus survives.
 */

(function () {
  const Core = EppsteinCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const innerBtn = document.getElementById("innerBtn");
  const outerBtn = document.getElementById("outerBtn");
  const resetBtn = document.getElementById("resetBtn");
  const board = Geom.board(document.getElementById("board"));

  const circlesLayer = board.layer("circles");
  const joinsLayer = board.layer("joins");
  const pointsLayer = board.layer("points");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});

  const vertexCircles = [0, 1, 2].map(() =>
    board.circle({ x: 0, y: 0 }, 1, "vertex-circle", circlesLayer));
  const soddyCircle = board.circle({ x: 0, y: 0 }, 1, "soddy-circle", circlesLayer);
  const joins = [0, 1, 2].map(() =>
    board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "join", joinsLayer));
  const touchDots = ["SA", "SB", "SC", "AB", "BC", "CA"].map(() =>
    board.point({ x: 0, y: 0 }, "touch-point", 3.5, pointsLayer));
  const meetDot = board.point({ x: 0, y: 0 }, "meet", 6, pointsLayer);
  const pointLabels = ["A", "B", "C"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "point-label", -14, -12, labelsLayer));

  const names = ["A", "B", "C"];
  const handles = names.map((name) => board.handle(name, state[name], {
    r: 9, step: 3, shift: 15, layer: handlesLayer,
    label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it.",
    clamp: (q) => ({
      x: Geom.clamp(q.x, 14, state.width - 14),
      y: Geom.clamp(q.y, 14, state.height - 14),
    }),
    onMove: (point) => {
      state = Core.setPoint(state, name, point);
      render();
    },
  }));

  /** The shared status line; this is a picture, so no win or loss is ever set. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const geom = Core.geometry(state);
    const visible = !!geom;
    for (const shape of vertexCircles.concat(soddyCircle, joins, touchDots, [meetDot], pointLabels)) {
      shape.show(true);
    }
    for (let i = 0; i < 3; i++) {
      handles[i].set(state[names[i]]);
      pointLabels[i].set(state[names[i]]);
    }

    if (visible) {
      for (let i = 0; i < 3; i++) {
        vertexCircles[i].set(geom.circles[i], geom.circles[i].r);
        joins[i].set(geom.lines[i].a, geom.lines[i].b);
      }
      soddyCircle.set(geom.S, geom.S.r);
      const keys = ["SA", "SB", "SC", "AB", "BC", "CA"];
      for (let i = 0; i < keys.length; i++) touchDots[i].set(geom.tangencies[keys[i]]);
      const meet = geom.eppstein || geom.M;
      meetDot.set(meet);
      say((state.inner ? "Inner" : "Outer") + " Soddy circle: radius " +
        geom.S.r.toFixed(1) + ". The three lines meet at (" +
        Math.round(meet.x) + ", " + Math.round(meet.y) + ").");
    } else {
      for (const shape of vertexCircles.concat([soddyCircle], joins, touchDots, [meetDot])) {
        shape.show(false);
      }
      say("Move the dots so they form a triangle; then the circles can touch.");
    }

    innerBtn.setAttribute("aria-pressed", String(state.inner));
    outerBtn.setAttribute("aria-pressed", String(!state.inner));
    innerBtn.classList.toggle("primary", state.inner);
    outerBtn.classList.toggle("primary", !state.inner);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  innerBtn.addEventListener("click", () => {
    state = Core.setInner(state, true);
    render();
  });
  outerBtn.addEventListener("click", () => {
    state = Core.setInner(state, false);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
