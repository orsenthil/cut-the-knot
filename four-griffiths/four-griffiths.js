"use strict";

/*
 * Four Griffiths — the drawing and the input, with all the geometry in
 * four-griffiths-core.js. The board holds the circumcircle of A, B, C, the
 * four triangles' pedal circles and nine-point circles (when asked for), the
 * line l through the centre O and L, the four Griffiths points and the line
 * they lie on. A, B, C, D and L are focusable, draggable handles; the three
 * checkboxes reproduce the applet's "Show names / circles / lines" options.
 * There is nothing to win: moving a point ends the exploration.
 */

(function () {
  const Core = FourGriffithsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const circlesBox = document.getElementById("circles");
  const linesBox = document.getElementById("lines");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  // Back to front: circles, quadrilateral, the two lines, result points,
  // names and finally the handles that keep keyboard focus across a redraw.
  const circlesLayer = board.layer("circles");
  const sidesLayer = board.layer("sides");
  const guidesLayer = board.layer("guides");
  const marksLayer = board.layer("marks");
  const namesLayer = board.layer("names");
  const handlesLayer = board.layer("handles");

  const circum = board.circle({ x: 300, y: 275 }, 160, "circum", circlesLayer);
  const pedalCircles = Array.from({ length: 4 }, () =>
    board.circle({ x: 0, y: 0 }, 1, "pedal-circle", circlesLayer));
  const nineCircles = Array.from({ length: 4 }, () =>
    board.circle({ x: 0, y: 0 }, 1, "nine-circle", circlesLayer));
  const sides = Array.from({ length: 6 }, () =>
    board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "side", sidesLayer));
  const lineL = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "line-l", guidesLayer);
  const lineG = board.line({ x: 0, y: 0 }, { x: 1, y: 1 }, "line-g", guidesLayer);
  const dotO = board.point({ x: 0, y: 0 }, "centre-dot", 4, marksLayer);
  const dotsG = Array.from({ length: 4 }, () =>
    board.point({ x: 0, y: 0 }, "griffiths-dot", 5, marksLayer));
  const dotP = board.point({ x: 0, y: 0 }, "meeting-dot", 6, marksLayer);
  const labels = {};
  for (const name of ["A", "B", "C", "D", "L", "O", "P"]) {
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
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    const opts = state.options;
    const handles = { A: state.A, B: state.B, C: state.C, D: state.D, L: state.L };
    for (const [name, p] of Object.entries(handles)) uiHandles[name].set(p);

    circum.set(g.circle.c, g.circle.r);
    sides[0].set(g.A, g.B); sides[1].set(g.B, g.C);
    sides[2].set(g.C, g.D); sides[3].set(g.D, g.A);
    sides[4].set(g.A, g.C); sides[5].set(g.B, g.D);
    for (const s of sides) s.show(opts.lines);

    for (let i = 0; i < 4; i++) {
      const p = g.pedalCircles[i], n = g.nineCircles[i];
      if (p) pedalCircles[i].set(p.c, p.r).show(opts.circles);
      else pedalCircles[i].show(false);
      if (n) nineCircles[i].set(n.c, n.r).show(opts.circles);
      else nineCircles[i].show(false);
    }

    // Geom clips these to the viewBox, so the lines shrink with the board.
    lineL.set(g.O, g.L).show(true);
    if (g.lineG) lineG.set(g.lineG[0], g.lineG[1]).show(true);
    else lineG.show(false);

    dotO.set(g.O);
    for (let i = 0; i < 4; i++) {
      dotsG[i].set(g.G[i] || { x: -100, y: -100 }).show(Boolean(g.G[i]));
    }
    dotP.set(g.P || { x: -100, y: -100 }).show(Boolean(g.P));

    const marked = { A: g.A, B: g.B, C: g.C, D: g.D, L: g.L, O: g.O, P: g.P };
    for (const name of Object.keys(labels)) {
      labels[name].set(marked[name] || { x: -100, y: -100 });
      labels[name].show(opts.names && Boolean(marked[name]));
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, L: g.L, O: g.O, P: g.P,
        G: g.G, circle: g.circle, options: opts,
      });
    }
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: handlesLayer,
    clamp: (p) => Core.clampPoint(p),
  };
  const uiHandles = {};
  for (const name of ["A", "B", "C", "D", "L"]) {
    uiHandles[name] = board.handle(name, state[name], Object.assign({}, handleOptions, {
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p) => { state = Core.move(state, name, p); render(); },
    }));
  }

  function toggle(name, box) {
    box.addEventListener("change", () => {
      state = Core.setOption(state, name, box.checked);
      render();
    });
  }
  toggle("names", namesBox);
  toggle("circles", circlesBox);
  toggle("lines", linesBox);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes; the theme hook keeps the hook provided by
  // Geom and redraws any position-dependent details on a theme flip.
  board.onTheme(render);
  render();
})();
