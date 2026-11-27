"use strict";

/*
 * The page for Four Incircles in an Equilateral Triangle: drawing and input
 * only; all the geometry is in four-incircles-in-triangle-core.js. The outer
 * triangle and the sliding circle are guides; the four incircles, the cevians
 * and the tangent parallels are built once and updated in place, so dragging
 * T never loses keyboard focus. Every colour comes from a site token.
 */

(function () {
  const Core = FourIncirclesInTriangleCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));

  const guides = board.layer("guides");
  const circleLayer = board.layer("circles");
  const cevianLayer = board.layer("cevians");
  const extraLayer = board.layer("extras");
  const dotsLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  let state = Core.start({});
  let last = Core.compute(state);

  // Guides: the equilateral triangle and the arc T slides on. The applet's
  // full circle is mostly outside its canvas; only the valid arc is drawn.
  const track = board.arc(state.glider.center, state.radius,
    -5 * Math.PI / 6, -Math.PI / 6, "track", guides);
  const outer = board.polygon([state.A, state.B, state.C], "outer-triangle", guides);

  // The four incircles, always present.
  const circleA = board.circle(state.center, 1, "corner-circle", circleLayer);
  const circleB = board.circle(state.center, 1, "corner-circle", circleLayer);
  const circleC = board.circle(state.center, 1, "corner-circle", circleLayer);
  const circleM = board.circle(state.center, 1, "middle-circle", circleLayer);

  // The three cevians and, once the radii match, their extensions and the
  // three parallel tangent lines the applet reveals at that moment.
  const cevians = [0, 1, 2].map(() => board.segment(state.A, state.B, "cevian", cevianLayer));
  const extensions = [0, 1, 2].map(() => board.line(state.A, state.B, "extension", extraLayer));
  const parallels = [0, 1, 2].map(() => board.line(state.A, state.B, "parallel", extraLayer));

  const vertexDots = [state.A, state.B, state.C].map(() =>
    board.point(state.A, "vertex-dot", 3, dotsLayer));
  const innerDots = [state.A, state.B, state.C].map(() =>
    board.point(state.A, "inner-dot", 3, dotsLayer));
  const centreDots = [state.A, state.B, state.C, state.A].map(() =>
    board.point(state.A, "centre-dot", 2.5, dotsLayer));

  const names = ["A", "B", "C", "A'", "B'", "C'"];
  const labels = names.map((name) =>
    board.label(state.A, name, "point-label", 5, -5, labelLayer));

  const handle = board.handle("T", state.T, {
    r: 9, step: 2, shift: 10, layer: handleLayer,
    label: "Point T on the sliding circle. Drag it, or focus it and use the arrow keys to move it around the circle.",
    describe: (p) => "at " + Math.round(p.x) + ", " + Math.round(p.y) + " on the board",
    clamp: (p) => Core.projectToGlider(p, state.glider),
    onMove: (p) => {
      state = Core.moveT(state, p);
      render();
    },
  });

  /**
   * The shared status line. "win", "lose", "done" end a play in the player's
   * record; this is a picture with no win or loss, so no kind is used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    // Compute() in the applet returns false below A and leaves the drawing as
    // it was; hold the last good diagram there instead of drawing nonsense.
    const fresh = Core.compute(state);
    const g = fresh || last;
    if (fresh) last = g;

    track.set(state.glider.center, state.radius, -5 * Math.PI / 6, -Math.PI / 6);
    outer.set([g.A, g.B, g.C]);
    circleA.set(g.circleA.center, g.circleA.radius);
    circleB.set(g.circleB.center, g.circleB.radius);
    circleC.set(g.circleC.center, g.circleC.radius);
    circleM.set(g.circleM.center, g.circleM.radius);

    for (let i = 0; i < 3; i++) {
      cevians[i].set(g.cevians[i].p, g.cevians[i].q);
      extensions[i].set(g.cevians[i].p, g.cevians[i].q);
      extensions[i].show(g.finished);
      parallels[i].set(g.parallels[i].p, g.parallels[i].q);
      parallels[i].show(g.finished);
    }

    const vertices = [g.A, g.B, g.C];
    const inner = [g.Ap, g.Bp, g.Cp];
    const centres = [g.circleA.center, g.circleB.center, g.circleC.center, g.circleM.center];
    for (let i = 0; i < 3; i++) {
      vertexDots[i].set(vertices[i], 3);
      innerDots[i].set(inner[i], 3);
      centreDots[i].set(centres[i], 2.5);
    }
    centreDots[3].set(centres[3], 2.5);

    const labelPoints = [g.A, g.B, g.C, g.Ap, g.Bp, g.Cp];
    for (let i = 0; i < names.length; i++) {
      labels[i].set(labelPoints[i], state.showNames ? names[i] : "", 5, -5);
    }

    handle.set(state.T);

    if (!fresh) {
      say("T is below A: the applet stops drawing there. Move T back onto the top arc.");
    } else if (g.finished) {
      say("The four circles match! A'B' is " + (g.side / g.outerSide).toFixed(3) +
        " times AB. The parallel lines now touch the other three circles.");
    } else {
      say("Middle circle " + g.rM.toFixed(1) + ", corner circles " + g.rA.toFixed(1) +
        ". Move T until all four have the same radius.");
    }
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  function turn(delta) {
    state = Core.turn(state, delta);
    render();
  }

  document.getElementById("leftBtn").addEventListener("click", () => turn(Math.PI / 72));
  document.getElementById("rightBtn").addEventListener("click", () => turn(-Math.PI / 72));
  document.getElementById("namesChk").addEventListener("change", (e) => {
    state = { ...state, showNames: e.target.checked };
    render();
  });
  document.getElementById("newBtn").addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(() => render());
  render();
})();
