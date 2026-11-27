"use strict";

/*
 * The drawing and input for Circles In Circles Sangaku.  All the geometry is
 * in circles-in-circles-sangaku-core.js; this file only draws the four small
 * circles, the three circles of radius r3, the lens circles and the optional
 * five-region circles on an SVG board.  X is the one draggable point, kept on
 * the diameter AB; the checkboxes and buttons reproduce the applet's options
 * and its two marked positions x = ±r/3.
 */

(function () {
  const Core = CirclesInCirclesSangakuCore;
  const O = Core.O;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const secondaryBox = document.getElementById("secondary");
  const fillBox = document.getElementById("fill");
  const leftBtn = document.getElementById("leftBtn");
  const rightBtn = document.getElementById("rightBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /* Layers, back to front: coloured fills, the big circle and its diameter,
   * the circles of the sangaku, the guide lines, dots, names and the handle. */
  const fills = board.layer("fills");
  const base = board.layer("base");
  const primary = board.layer("primary");
  const lens = board.layer("lens");
  const secondary = board.layer("secondary");
  const guides = board.layer("guides");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const bigCircle = board.circle(O, Core.R, "big-circle", base);
  const baseline = board.segment({ x: O.x - Core.R, y: O.y }, { x: O.x + Core.R, y: O.y }, "baseline", base);

  const fill4 = [0, 1, 2, 3].map(() => board.circle(O, 1, "fill-r1", fills));
  const fill3 = [0, 1, 2].map(() => board.circle(O, 1, "fill-r3", fills));
  const fill2 = [0, 1].map(() => board.circle(O, 1, "fill-r5", fills));
  const circle4 = [0, 1, 2, 3].map(() => board.circle(O, 1, "circle-r1", primary));
  const circle3 = [0, 1, 2].map(() => board.circle(O, 1, "circle-r3", primary));
  const circle2 = [0, 1].map(() => board.circle(O, 1, "circle-r5", lens));
  const circle5 = [0, 1, 2, 3, 4].map(() => board.circle(O, 1, "circle-secondary", secondary));

  const oxLine = board.segment(O, O, "guide", guides);
  const oCentreLine = board.segment(O, O, "guide", guides);
  const dotA = board.point(O, "dot", 3.5, dots);
  const dotB = board.point(O, "dot", 3.5, dots);
  const dotO = board.point(O, "dot", 3.5, dots);

  const labelText = {
    A: "A", B: "B", O: "O", X: "X", R3: "r₃", R5: "r₅",
  };
  const labelOffset = {
    A: [-6, 20], B: [-6, 20], O: [-6, 20], X: [-4, -9], R3: [8, 5], R5: [8, -6],
  };
  const labels = {};
  for (const key of Object.keys(labelText)) {
    labels[key] = board.label(O, labelText[key], "point-label", labelOffset[key][0], labelOffset[key][1], names);
  }

  const handleX = board.handle("X", { x: state.x, y: O.y }, {
    r: 8, step: 2, shift: 10, layer: top,
    label: "Point X, where a small circle touches the diameter. Drag it or use the arrow keys.",
    clamp: (q) => ({ x: Core.project(state, q), y: O.y }),
    describe: (p) => "at " + Math.round(p.x - O.x) + " units from O",
    onMove: (p) => {
      state = Core.move(state, "X", p);
      render();
    },
  });

  /** `#status` speaks the radii; "done" marks an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ x: state.x, r: state.r });
      return;
    }

    bigCircle.set(g.O, g.r);
    baseline.set(g.A, g.B);
    for (let i = 0; i < 4; i++) {
      const c = g.circles4[i];
      circle4[i].set(c, c.r);
      fill4[i].set(c, c.r);
      fill4[i].show(state.options.fill);
    }
    for (let i = 0; i < 3; i++) {
      const c = g.circles3[i];
      circle3[i].set(c, c.r);
      fill3[i].set(c, c.r);
      fill3[i].show(state.options.fill);
    }
    for (let i = 0; i < 2; i++) {
      const c = g.circles2[i];
      circle2[i].show(!!c);
      fill2[i].show(state.options.fill && !!c);
      if (c) {
        circle2[i].set(c, c.r);
        fill2[i].set(c, c.r);
      }
    }
    for (let i = 0; i < 5; i++) {
      const c = g.circles5[i];
      circle5[i].show(state.options.secondary && !!c);
      if (c) circle5[i].set(c, c.r);
    }

    oxLine.set(g.O, g.X);
    oCentreLine.set(g.O, g.circles4[0]);
    dotA.set(g.A);
    dotB.set(g.B);
    dotO.set(g.O);
    handleX.set(g.X);

    labels.A.set(g.A);
    labels.B.set(g.B);
    labels.O.set(g.O);
    labels.X.set(g.X);
    labels.R3.set(g.circles3[0]);
    labels.R5.set(g.circles2[0] || g.O);
    for (const key of Object.keys(labels)) labels[key].show(state.options.names);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, O: g.O, X: g.X, r: g.r, x: g.x, signedX: g.signedX,
        r1: g.r1, r3: g.r3, r4: g.r4, r5: g.r5,
        circles4: g.circles4, circles3: g.circles3,
        circles2: g.circles2, circles5: g.circles5,
        special: g.special, options: state.options,
      });
    }
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("secondary", secondaryBox);
  toggle("fill", fillBox);

  leftBtn.addEventListener("click", () => {
    state = Core.setSpecial(state, -1);
    render();
  });
  rightBtn.addEventListener("click", () => {
    state = Core.setSpecial(state, 1);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
