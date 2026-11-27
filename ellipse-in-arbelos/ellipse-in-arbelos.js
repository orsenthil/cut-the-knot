"use strict";

/*
 * Page for Ellipse in Arbelos: drawing and input only; all the geometry is in
 * ellipse-in-arbelos-core.js. Two circles touch at A; the point C is a
 * focusable handle on the diameter AB and sets the small circle's diameter.
 * The dashed ellipse is the locus of the centres of circles that touch both
 * circles; the blue chain circles are the family C_t. Every shape is made once
 * and only its attributes change, so keyboard focus stays on C while dragging
 * or changing the sliders. This is a picture with no win or loss.
 */

(function () {
  const Core = EllipseInArbelosCore;
  const board = window.Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const locusLayer = board.layer("locus");
  const chainLayer = board.layer("chain");
  const guides = board.layer("guides");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  const bigFill = board.circle(Core.A, Core.R, "circle-fill", fills);
  const smallFill = board.circle(Core.A, 1, "circle-cut", fills);
  const bigCircle = board.circle({ x: Core.A.x + Core.R, y: Core.A.y }, Core.R, "outline", fills);
  const smallCircle = board.circle({ x: Core.A.x + 1, y: Core.A.y }, 1, "outline", fills);
  const ovalNode = board.el("ellipse", null, "locus", locusLayer);

  const diameter = board.segment(Core.A, Core.B, "diameter", guides);
  const focusSmall = board.point(Core.A, "focus", 3.5, guides);
  const focusBig = board.point(Core.B, "focus", 3.5, guides);
  const labelA = board.label(Core.A, "A", "point-label", -13, 18, labels);
  const labelB = board.label(Core.B, "B", "point-label", 7, 18, labels);
  const labelC = board.label(Core.A, "C", "point-label", 7, -8, labels);

  // Twenty is the applet's maximum; the unused chain shapes are hidden.
  const chain = Array.from({ length: Core.MAX_N }, () => ({
    circle: board.circle(Core.A, 1, "chain-circle", chainLayer),
    dot: board.point(Core.A, "chain-centre", 3, chainLayer),
  }));

  const cHandle = board.handle("C", { x: Core.A.x + Core.SIDE / 2, y: Core.A.y }, {
    r: 9, step: 4, shift: 20, layer: handles,
    label: "Point C on the diameter AB. Drag it, or focus it and press the arrow keys to change the small circle.",
    describe: (p) => "on the diameter at " + Math.round(p.x - Core.A.x) + " board units from A",
    clamp: (q) => ({
      x: window.Geom.clamp(q.x, Core.A.x + Core.MIN_GAP, Core.B.x - Core.MIN_GAP),
      y: Core.A.y,
    }),
    onMove: (p) => {
      state = Core.setFraction(state, Core.fractionAtX(p.x));
      render();
    },
  });

  const statusEl = document.getElementById("status");
  const nRange = document.getElementById("nRange");
  const tRange = document.getElementById("tRange");
  const nOut = document.getElementById("nOut");
  const tOut = document.getElementById("tOut");
  const ellipseChk = document.getElementById("ellipseChk");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and tells the
   * player's record that a play ended. This illustration cannot be won, so no
   * kind is ever passed; it just reports what is drawn.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function syncControls(g) {
    nRange.value = String(g.state.n);
    nOut.textContent = String(g.state.n);
    tRange.value = String(g.state.t);
    tOut.textContent = g.state.t.toFixed(2);
  }

  const fmt = (v) => v.toFixed(2);

  function render() {
    const g = Core.geometry(state);
    const smallCenter = { x: Core.A.x + g.r, y: Core.A.y };
    const bigCenter = { x: Core.A.x + g.R, y: Core.A.y };

    bigFill.set(bigCenter, g.R);
    smallFill.set(smallCenter, g.r);
    bigCircle.set(bigCenter, g.R);
    smallCircle.set(smallCenter, g.r);

    const e = g.ellipse;
    ovalNode.setAttribute("cx", e.cx);
    ovalNode.setAttribute("cy", e.cy);
    ovalNode.setAttribute("rx", e.rx);
    ovalNode.setAttribute("ry", e.ry);
    ovalNode.style.display = ellipseChk.checked ? "" : "none";

    diameter.set(Core.A, Core.B);
    focusSmall.set(smallCenter);
    focusBig.set(bigCenter);
    labelA.set(Core.A, "A", -13, 18);
    labelB.set(Core.B, "B", 7, 18);
    labelC.set(g.C, "C", 7, -8);
    cHandle.set(g.C);

    for (let i = 0; i < chain.length; i++) {
      const c = g.circles[i];
      const shown = i < g.circles.length;
      chain[i].circle.show(shown);
      chain[i].dot.show(shown);
      if (c) {
        chain[i].circle.set(c.center, c.radius);
        chain[i].dot.set(c.center);
      }
    }

    syncControls(g);
    const first = g.circles[0];
    say("Small circle radius " + fmt(g.r) + ", big circle radius " + fmt(g.R) +
      ". The dashed ellipse has semiaxes " + fmt(g.major) + " and " + fmt(g.minor) +
      " (the square root of their product). " + g.circles.length +
      " chain circles are drawn at shift " + fmt(g.state.t) +
      "; the first has radius " + fmt(first.radius) +
      ". Each one touches both circles and its neighbour.");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  nRange.addEventListener("input", () => {
    state = Core.setN(state, Number(nRange.value));
    render();
  });
  tRange.addEventListener("input", () => {
    state = Core.setT(state, Number(tRange.value));
    render();
  });
  ellipseChk.addEventListener("change", render);
  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  board.onTheme(() => render());

  render();
})();
