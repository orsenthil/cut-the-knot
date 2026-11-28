"use strict";

/*
 * The page for In And Circumcenter B: drawing and input only. The geometry
 * lives in in-and-circumcenter-b-core.js. An SVG board holds the triangle, the
 * two circles, and the two lines DE and IO; A, B and C are draggable Geom
 * handles, so a pointer or the arrow keys can reshape the triangle. Four
 * checkboxes reproduce the applet's names, statement, premise and hint
 * switches, and Reset brings back the opening picture.
 */

(function () {
  const Core = InAndCircumcenterBCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    guides: board.layer("guides"),
    triangle: board.layer("triangle"),
    hints: board.layer("hints"),
    marks: board.layer("marks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const circumcircle = board.circle({ x: 180, y: 180 }, 110, "circumcircle", layers.circles);
  const incircle = board.circle({ x: 180, y: 180 }, 40, "incircle", layers.circles);
  const ioLine = board.line(state.A, state.B, "io-line", layers.guides);
  const deLine = board.line(state.A, state.B, "de-line", layers.guides);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);

  // ShowHint draws these seven helper segments, in the applet's own order.
  const hintLines = Array.from({ length: 7 }, () =>
    board.segment(state.A, state.B, "hint-line", layers.hints));
  // ShowPremise marks AB, AE and BD with two equality ticks each.
  const ticks = Array.from({ length: 6 }, () =>
    board.segment(state.A, state.B, "tick", layers.marks));

  const dDot = board.point(state.A, "derived-dot", 4.5, layers.dots);
  const eDot = board.point(state.A, "derived-dot", 4.5, layers.dots);
  const iDot = board.point(state.A, "i-dot", 4.5, layers.dots);
  const oDot = board.point(state.A, "o-dot", 4.5, layers.dots);
  const mDot = board.point(state.A, "helper-dot", 4, layers.dots);
  const fDot = board.point(state.A, "helper-dot", 4, layers.dots);
  const rightMark = board.rightAngle(state.A, state.B, state.C, 10, "right-mark", layers.marks);

  const labelOffsets = {
    A: [-12, 19], B: [8, 3], C: [-12, -8], D: [7, 17], E: [-17, -2],
    I: [7, 17], O: [7, -8], M: [7, 16], F: [8, -8],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 3,
      shift: 5,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => {
        const inside = Core.clampPoint(q);
        return Core.NAMES.some((other) => other !== which && Core.dist(inside, state[other]) < Core.MIN_SEPARATION)
          ? state[which] : inside;
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p }),
    });
  }

  const show = (shape, on) => shape.show(on);

  /** Put two short perpendicular marks across a segment, as LineID does. */
  function setTicks(from, to, first) {
    const dx = to.x - from.x, dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length, uy = dy / length;
    for (let i = 0; i < 2; i++) {
      const center = {
        x: (from.x + to.x) / 2 + ux * (i === 0 ? -4 : 4),
        y: (from.y + to.y) / 2 + uy * (i === 0 ? -4 : 4),
      };
      ticks[first + i].set(
        { x: center.x - uy * 4, y: center.y + ux * 4 },
        { x: center.x + uy * 4, y: center.y - ux * 4 },
      );
    }
  }

  function statusText() {
    if (geometry.degenerate) return "Put the three corners apart so they make a triangle.";
    const degrees = geometry.angleC * 180 / Math.PI;
    if (Math.abs(degrees - 30) < 0.05) {
      return "Angle C is about 30°: DE is at right angles to IO and both are "
        + geometry.DE.toFixed(1) + " units long.";
    }
    if (Math.abs(degrees - 150) < 0.05) {
      return "Angle C is about 150°: DE = IO here as well, and the two lines are still at right angles.";
    }
    return "Angle C is about " + degrees.toFixed(1) + "°: DE stays at right angles to IO, but it is "
      + (geometry.DE / geometry.IO).toFixed(2) + " times as long.";
  }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    for (const name of Core.NAMES) handles[name].set(state[name]);

    for (const shape of [circumcircle, incircle, ioLine, deLine, dDot, eDot, iDot, oDot,
      mDot, fDot, rightMark, ...hintLines, ...ticks]) show(shape, false);
    for (const name of Object.keys(labels)) labels[name].show(false);
    if (geometry.degenerate) return;

    const { A, B, C, I, O, D, E, F, M, S, inRadius, outRadius } = geometry;
    circumcircle.set(O, outRadius).show(state.showPremise || state.showHint);
    incircle.set(I, inRadius).show(state.showPremise || state.showHint);
    ioLine.set(I, O).show(true);
    deLine.set(D, E).show(true);
    dDot.set(D).show(true);
    eDot.set(E).show(true);
    iDot.set(I).show(true);
    oDot.set(O).show(true);

    // ShowHint: IB, OF, EB, FB, EF, ED and AF, plus the yellow M and F dots.
    const helper = [
      [I, B], [O, F], [E, B], [F, B], [E, F], [E, D], [A, F],
    ];
    for (let i = 0; i < helper.length; i++) {
      hintLines[i].set(helper[i][0], helper[i][1]).show(state.showHint);
    }
    mDot.set(M).show(state.showHint);
    fDot.set(F).show(state.showHint);

    if (state.showPremise) {
      setTicks(A, B, 0);
      setTicks(A, E, 2);
      setTicks(B, D, 4);
      for (const tick of ticks) tick.show(true);
    }

    // ShowStatement: the applet uses the nearer of I and O as the second arm.
    const nearer = Core.dist(I, S) > Core.dist(O, S) ? I : O;
    rightMark.set(S, E, nearer, 10).show(state.showStatement);

    const named = { A, B, C, D, E, I, O, M, F };
    for (const name of Object.keys(labels)) {
      const visible = state.showNames && (name !== "M" && name !== "F" || state.showHint);
      labels[name].set(named[name]).show(visible);
    }
  }

  /** Redraw, speak the measured fact and save the position for the record. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) {
      if (m.type === "point") handles[m.name].set(state[m.name]);
      say("That spot is too close to another corner.");
      return false;
    }
    state = next;
    render(); // render() speaks the measured claim, not a move-by-move log
    return true;
  }

  const checkboxes = {
    namesBox: "showNames",
    statementBox: "showStatement",
    premiseBox: "showPremise",
    hintBox: "showHint",
  };
  for (const [id, key] of Object.entries(checkboxes)) {
    const box = document.getElementById(id);
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked });
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" });
  });

  // Colours are CSS classes, so a theme flip only redraws the geometry.
  board.onTheme(() => draw());

  render();
})();
