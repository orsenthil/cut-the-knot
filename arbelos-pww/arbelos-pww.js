"use strict";

/*
 * The page for Arbelos PWW: drawing and input only; the geometry is in
 * arbelos-pww-core.js. A big semicircle sits on AB, two smaller ones sit on
 * AN and NB, and N is a focusable handle on AB. The upright through N reaches
 * the big circle at P above and D below. Three pairs of coloured semicircles
 * show Euclid's proof: blue and red halves on the upright, sloping halves on
 * AD and BD, and the two small halves on AN and NB. Every shape is made once
 * and redrawn in place, so dragging or using the arrow keys keeps focus.
 */

(function () {
  const Core = ArbelosPwwCore;
  const Geom = window.Geom;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const middleBtn = document.getElementById("middleBtn");
  const board = Geom.board(document.getElementById("board"));

  const fills = board.layer("fills");
  const outlines = board.layer("outlines");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  /** A filled semicircle on the diameter p..q, bulging away from `away`. */
  function semiShape(cls, layer) {
    const node = board.el("path", null, cls, layer);
    return {
      node: node,
      set: function (p, q, away) {
        const c = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
        const r = Math.hypot(q.x - p.x, q.y - p.y) / 2;
        const a0 = Math.atan2(p.y - c.y, p.x - c.x);
        const ccw = { x: c.x + r * Math.cos(a0 - Math.PI / 2), y: c.y + r * Math.sin(a0 - Math.PI / 2) };
        const cw = { x: c.x + r * Math.cos(a0 + Math.PI / 2), y: c.y + r * Math.sin(a0 + Math.PI / 2) };
        const sweep = away && Geom.distance(ccw, away) >= Geom.distance(cw, away) ? 0 : 1;
        node.setAttribute("d",
          `M ${p.x} ${p.y} A ${r} ${r} 0 0 ${sweep} ${q.x} ${q.y} Z`);
        return node;
      },
      show: function (on) { node.style.display = on ? "" : "none"; return node; },
    };
  }

  const below = { x: Core.RECT.x + Core.SIDE / 2, y: Core.BASE_Y + 30 };

  const bigFill = semiShape("pww-big", fills);
  const leftFill = semiShape("pww-blue pww-small", fills);
  const rightFill = semiShape("pww-red pww-small", fills);
  const blueSlope = semiShape("pww-blue pww-slope", marks);
  const redSlope = semiShape("pww-red pww-slope", marks);
  const blueHalf = semiShape("pww-blue pww-half", marks);
  const redHalf = semiShape("pww-red pww-half", marks);
  const answerCircle = board.circle({ x: 0, y: 0 }, 1, "pww-answer", marks);

  const bigArc = semiShape("pww-outline", outlines);
  const leftArc = semiShape("pww-outline", outlines);
  const rightArc = semiShape("pww-outline", outlines);
  const upright = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "pww-upright", guides);
  const rayA = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "pww-ray", guides);
  const rayB = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "pww-ray", guides);
  const baseline = board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "pww-baseline", guides);

  const labelA = board.label({ x: 0, y: 0 }, "A", "point-label", -16, 22, labels);
  const labelB = board.label({ x: 0, y: 0 }, "B", "point-label", 4, 22, labels);
  const labelN = board.label({ x: 0, y: 0 }, "N", "point-label", -6, 24, labels);
  const labelP = board.label({ x: 0, y: 0 }, "P", "point-label", 6, -6, labels);
  const labelD = board.label({ x: 0, y: 0 }, "D", "point-label", 6, 16, labels);

  let state = Core.start({});

  const nHandle = board.handle("N", Core.geometry(state).N, {
    r: 12, step: 4, shift: 20, layer: handles,
    label: "Point N on the line AB. Drag it, or focus it and press the arrow keys to move it.",
    describe: (p) => "at x = " + Math.round(p.x) + ", on the line AB",
    clamp: (q) => ({
      x: Geom.clamp(q.x, Core.RECT.x + Core.MIN_GAP, Core.RECT.x + Core.SIDE - Core.MIN_GAP),
      y: Core.BASE_Y,
    }),
    onMove: (p) => {
      state = Core.setT(state, Core.fractionAtX(p.x));
      render();
    },
  });

  /**
   * The shared status line. `kind` is "win", "lose" or "done" and is how a
   * game page tells the player's record a play ended; this is a picture with
   * no win or loss, so it reports the measurements and passes no kind.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => v.toFixed(1);

  function render() {
    const g = Core.geometry(state);

    bigFill.set(g.A, g.B, below);
    leftFill.set(g.A, g.N, below);
    rightFill.set(g.N, g.B, below);
    bigArc.set(g.A, g.B, below);
    leftArc.set(g.A, g.N, below);
    rightArc.set(g.N, g.B, below);

    upright.set(g.P, g.D);
    rayA.set(g.A, g.D);
    rayB.set(g.B, g.D);
    baseline.set(g.A, g.B);

    blueSlope.set(g.A, g.D, g.N);
    redSlope.set(g.D, g.B, g.N);
    blueHalf.set(g.N, g.D, g.A);
    redHalf.set(g.N, g.D, g.B);
    answerCircle.set(g.circle.centre, g.circle.radius);

    labelA.set(g.A);
    labelB.set(g.B);
    labelN.set(g.N);
    labelP.set(g.P);
    labelD.set(g.D);
    nHandle.set(g.N);

    say("AN " + fmt(g.a) + ", NB " + fmt(g.b) + ". The upright is " + fmt(g.h) +
      ". Arbelos " + fmt(g.arbelosArea) + " = circle on the upright " + fmt(g.circleArea) +
      ". Big half-circle = sloping blue + sloping red; each sloping one = a small one + half this circle.");

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  resetBtn.addEventListener("click", () => {
    state = Core.start({});
    render();
  });
  middleBtn.addEventListener("click", () => {
    state = Core.setT(state, 0.5);
    render();
  });

  board.onTheme(() => render());
  render();
})();
