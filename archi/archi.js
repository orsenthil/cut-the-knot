"use strict";

/*
 * The page for Archimedes' angle trisection: drawing and input only. The
 * geometry is in archi-core.js. B is dragged around the circle to choose the
 * angle AOB; C slides along the horizontal line to the left of O; D is placed
 * one radius from C on the ray towards B. Both control rings stay focusable,
 * so the figure can also be set up with the arrow keys.
 */

(function () {
  const Core = ArchiCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /** The line under the board. "done" tells the record the demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: guides, the construction, labels, draggable handles.
  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  const O = Core.O, R = Core.R;
  const axis = board.line({ x: 0, y: O.y }, { x: Core.WIDTH, y: O.y }, "axis", guides);
  const circle = board.circle(O, R, "circle-base", guides);
  const angleO = board.angleArc(O, { x: O.x + R, y: O.y }, state.B, 17, "angle", guides);
  const angleC = board.angleArc(state.C, O, state.C, 19, "third", guides);
  const segOB = board.segment(O, state.B, "radius", shapes);
  const segCD = board.segment(state.C, state.C, "neusis", shapes);
  const dotD = board.point(state.C, "dot-d", 5, shapes);
  const ringB = board.circle(state.B, 12, "ring", shapes);
  const ringC = board.circle(state.C, 12, "ring", shapes);

  const labelO = board.label(O, "O", "pt-label", -13, 18, labels);
  const labelA = board.label({ x: O.x + R, y: O.y }, "A", "pt-label", 7, 17, labels);
  const labelB = board.label(state.B, "B", "pt-label", 8, -10, labels);
  const labelC = board.label(state.C, "C", "pt-label", -15, -10, labels);
  const labelD = board.label(state.C, "D", "pt-label", 8, -10, labels);

  const clampB = (q) => ({ x: Core.clamp(q.x, 4, Core.WIDTH - 4), y: Core.clamp(q.y, 4, Core.HEIGHT - 4) });
  const clampC = (q) => ({ x: Core.clamp(q.x, 4, O.x - 1), y: O.y });
  const onMove = (p, name) => {
    const next = Core.move(state, { type: name, x: p.x, y: p.y });
    if (!next) render(); // put the handle back where the applet would leave it
    else { state = next; render(); }
  };
  const B = board.handle("B", state.B, {
    r: 7, step: 1, shift: 5, clamp: clampB, onMove, layer: handles,
    label: "Point B. Drag it, or focus it and use the arrow keys to set the angle.",
    describe: (p) => `on the circle at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const Cc = board.handle("C", state.C, {
    r: 7, step: 1, shift: 5, clamp: clampC, onMove, layer: handles,
    label: "Point C. Drag it along the line, or focus it and use the arrow keys to slide it left and right.",
    describe: (p) => `on the line left of O at x ${Math.round(p.x)}`,
  });

  function render() {
    const g = Core.construct(state);
    axis.set({ x: 0, y: O.y }, { x: Core.WIDTH, y: O.y });
    circle.set(g.O, g.R);
    angleO.set(O, g.A, g.B, 17);
    segOB.set(g.O, g.B);
    segCD.set(g.C, g.D || g.C);
    dotD.set(g.D || g.C);
    ringB.set(g.B);
    ringC.set(g.C);

    labelO.set(g.O);
    labelA.set(g.A);
    labelB.set(g.B);
    labelC.set(g.C);
    labelD.set(g.D || g.C);

    B.set(g.B);
    Cc.set(g.C);

    // The one-third arc is the applet's closing flourish: it appears exactly
    // when D lands on the circle and really is the non-degenerate solution.
    const trisects = g.trisects;
    if (trisects) angleC.set(g.C, g.O, g.D, 19).show(true);
    else angleC.show(false);
    dotD.node.classList.toggle("on-circle", g.onCircle);
    segCD.node.classList.toggle("on-circle", g.onCircle);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state({
      B: g.B, C: g.C, D: g.D,
      angleDeg: g.angleDeg,
      thirdDeg: Core.deg(g.angleAtC),
      onCircle: g.onCircle,
      trisects: trisects,
    });
    say(Core.describe(g), Core.result(state) || undefined);
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start();
    render();
  });
  board.onTheme(() => render());

  render();
})();
