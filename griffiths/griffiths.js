"use strict";

/*
 * Griffiths — the drawing and the input, with all the geometry in
 * griffiths-core.js. The SVG board holds the triangle ABC, the line through
 * its circumcentre O and the two points P and Q, the perpendicular feet for
 * the two checkboxes, the pedal circles with the nine-point circle, and the
 * dot where all three meet. A, B, C, P and Q are focusable draggable handles;
 * there is no win or loss, only an illustration to explore.
 */

(function () {
  const Core = GriffithsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const perpsBox = document.getElementById("perps");
  const circlesBox = document.getElementById("circles");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  // Back to front: circles, sides and the line, perpendiculars, result dots,
  // names, then the handles so that keyboard focus survives a redraw.
  const circlesLayer = board.layer("circles");
  const sidesLayer = board.layer("sides");
  const guidesLayer = board.layer("guides");
  const feetLayer = board.layer("feet");
  const marksLayer = board.layer("marks");
  const namesLayer = board.layer("names");
  const handlesLayer = board.layer("handles");

  const circum = board.circle({ x: 250, y: 150 }, 100, "circum", circlesLayer);
  const pedalP = board.circle({ x: 0, y: 0 }, 1, "pedal-p", circlesLayer);
  const pedalQ = board.circle({ x: 0, y: 0 }, 1, "pedal-q", circlesLayer);
  const nine = board.circle({ x: 0, y: 0 }, 1, "nine-circle", circlesLayer);
  const sides = Array.from({ length: 3 }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "side", sidesLayer));
  const lineL = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "line-l", guidesLayer);
  const feetP = Array.from({ length: 3 }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "foot-p", feetLayer));
  const feetQ = Array.from({ length: 3 }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "foot-q", feetLayer));
  const midFeet = Array.from({ length: 3 }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "foot-o", feetLayer));
  const dotO = board.point({ x: 0, y: 0 }, "centre-dot", 4, marksLayer);
  const dotG = board.point({ x: 0, y: 0 }, "griffiths-dot", 6, marksLayer);
  const labels = {};
  for (const name of ["A1", "A2", "A3", "P", "Q", "O"]) {
    labels[name] = board.label({ x: 0, y: 0 }, name, "point-label", 9, -9, namesLayer);
  }

  /** `#status` is how the player's record sees that the picture was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    if (!g) {
      for (const shape of [circum, pedalP, pedalQ, nine, lineL, dotO, dotG]) shape.show(false);
      for (const shape of [...sides, ...feetP, ...feetQ, ...midFeet]) shape.show(false);
      for (const label of Object.values(labels)) label.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    const handles = { A: g.A, B: g.B, C: g.C, P: g.P, Q: g.Q };
    for (const name of Object.keys(handles)) uiHandles[name].set(handles[name]);

    if (g.circle) circum.set(g.circle.c, g.circle.r).show(true);
    else circum.show(false);
    sides[0].set(g.A, g.B); sides[1].set(g.B, g.C); sides[2].set(g.C, g.A);
    for (const side of sides) side.show(true);
    lineL.set(g.O, g.P).show(true);

    for (let i = 0; i < 3; i++) {
      feetP[i].set(g.P, g.PFeet[i]).show(state.options.perps);
      feetQ[i].set(g.Q, g.QFeet[i]).show(state.options.perps);
      midFeet[i].set(g.O, g.midFeet[i]).show(state.options.perps);
    }
    if (g.Pcircle) pedalP.set(g.Pcircle.c, g.Pcircle.r).show(state.options.circles);
    else pedalP.show(false);
    if (g.Qcircle) pedalQ.set(g.Qcircle.c, g.Qcircle.r).show(state.options.circles);
    else pedalQ.show(false);
    if (g.nine) nine.set(g.nine.c, g.nine.r).show(state.options.circles);
    else nine.show(false);

    dotO.set(g.O).show(true);
    dotG.set(g.common || { x: -100, y: -100 }).show(Boolean(g.common) && state.options.circles);
    const named = { A1: g.A, A2: g.B, A3: g.C, P: g.P, Q: g.Q, O: g.O };
    for (const name of Object.keys(labels)) labels[name].set(named[name]).show(true);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, P: g.P, Q: g.Q, O: g.O,
        common: g.common, Pcircle: g.Pcircle, Qcircle: g.Qcircle,
        nine: g.nine, options: g.options,
      });
    }
  }

  const handleOptions = {
    step: 5, shift: 15, r: 8, layer: handlesLayer,
    clamp: (p) => Core.clampPoint(p),
  };
  const uiHandles = {};
  for (const name of ["A", "B", "C", "P", "Q"]) {
    uiHandles[name] = board.handle(name, state[name], Object.assign({}, handleOptions, {
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p) => { state = Core.move(state, name, p); render(); },
    }));
  }

  perpsBox.addEventListener("change", () => {
    state = Core.setOption(state, "perps", perpsBox.checked);
    render();
  });
  circlesBox.addEventListener("change", () => {
    state = Core.setOption(state, "circles", circlesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes; Geom's theme hook keeps them in step with
  // the site's light/dark switch.
  board.onTheme(render);
  render();
})();
