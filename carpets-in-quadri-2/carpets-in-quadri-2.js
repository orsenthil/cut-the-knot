"use strict";

/*
 * Carpets in a Quadrilateral II — drawing and input only.  The geometry lives
 * in carpets-in-quadri-2-core.js: four draggable corners, the side midpoints
 * E,F,G,H, the four crossings P,Q,R,S, and the two translucent carpets.  Shapes
 * are created once and only updated on a redraw, so a handle keeps keyboard
 * focus.  SVG colours come from CSS classes, so a theme flip needs no rebuild.
 */

(function () {
  const Core = CarpetsInQuadri2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const p1Box = document.getElementById("partition1");
  const p2Box = document.getElementById("partition2");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const cuts = board.layer("cuts");
  const outlines = board.layer("outlines");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  /* Draw() paints partition 1 first, then partition 2, over the same image. */
  const redTriangles = [
    board.polygon([state.A, state.B, state.A], "carpet-red", fills),
    board.polygon([state.C, state.D, state.A], "carpet-red", fills),
    board.polygon([state.A, state.A, state.D], "carpet-red", fills),
    board.polygon([state.C, state.A, state.B], "carpet-red", fills),
  ];
  const blueQuads = [
    board.polygon([state.A, state.A, state.C, state.A], "carpet-blue", fills),
    board.polygon([state.B, state.A, state.D, state.A], "carpet-blue", fills),
  ];

  const cutLines = [
    board.segment(state.A, state.A, "cut cut-one", cuts),
    board.segment(state.C, state.A, "cut cut-one", cuts),
    board.segment(state.B, state.A, "cut cut-two", cuts),
    board.segment(state.D, state.A, "cut cut-two", cuts),
  ];
  const diagonals = [
    board.segment(state.A, state.C, "diagonal", cuts),
    board.segment(state.B, state.D, "diagonal", cuts),
  ];
  const inner = board.polygon([state.A, state.B, state.C, state.D], "inner", outlines);
  const outline = board.polygon([state.A, state.B, state.C, state.D], "quad", outlines);

  const midKeys = ["E", "F", "G", "H"];
  const crossKeys = ["P", "Q", "R", "S"];
  const midDots = midKeys.map((key) => board.point(state.A, "midpoint", 4, dots));
  const crossDots = crossKeys.map((key) => board.point(state.A, "crossing", 5, dots));

  const labelKeys = ["A", "B", "C", "D", "E", "F", "G", "H", "P", "Q", "R", "S"];
  const labelPos = {
    A: [-16, -9], B: [8, -9], C: [8, 17], D: [-16, 17],
    E: [-6, -9], F: [8, -6], G: [8, 16], H: [-16, 4],
    P: [-17, -8], Q: [8, -8], R: [8, 17], S: [-17, 17],
  };
  const labelsFor = {};
  for (const key of labelKeys) {
    const off = labelPos[key];
    labelsFor[key] = board.label(state.A, key, "point-label", off[0], off[1], labels);
  }

  const cornerKeys = ["A", "B", "C", "D"];
  const handles = {};
  for (const key of cornerKeys) {
    handles[key] = board.handle(key, state[key], {
      step: 5, shift: 15, r: 9, layer: top,
      clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of cornerKeys) handles[key].set(state[key]);

    if (!g) {
      for (const s of redTriangles.concat(blueQuads, cutLines, diagonals, [inner, outline],
        midDots, crossDots)) s.show(false);
      for (const key of labelKeys) labelsFor[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) {
        window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D,
          options: state.options });
      }
      return;
    }

    const sh = Core.shapes(g);
    for (let i = 0; i < 2; i++) {
      redTriangles[i].set(sh.partition1.triangles[i]);
      redTriangles[i + 2].set(sh.partition2.triangles[i]);
    }
    blueQuads[0].set(sh.partition1.quads[0]);
    blueQuads[1].set(sh.partition2.quads[0]);
    for (let i = 0; i < 4; i++) {
      redTriangles[i].show(i < 2 ? state.options.partition1 : state.options.partition2);
    }
    blueQuads[0].show(state.options.partition1);
    blueQuads[1].show(state.options.partition2);

    for (let i = 0; i < 4; i++) {
      const seg = sh[i < 2 ? "partition1" : "partition2"].lines[i % 2];
      cutLines[i].set(seg[0], seg[1]);
    }
    for (const s of cutLines.slice(0, 2)) s.show(state.options.partition1);
    for (const s of cutLines.slice(2)) s.show(state.options.partition2);
    diagonals[0].set(sh.partition1.dashed[0], sh.partition1.dashed[1]);
    diagonals[1].set(sh.partition2.dashed[0], sh.partition2.dashed[1]);
    diagonals[0].show(!state.options.partition2);
    diagonals[1].show(!state.options.partition1);
    inner.set([g.P, g.Q, g.R, g.S]);
    inner.show(true);
    outline.set([g.A, g.B, g.C, g.D]);
    outline.show(true);

    for (let i = 0; i < midKeys.length; i++) midDots[i].set(g[midKeys[i]]);
    for (let i = 0; i < crossKeys.length; i++) crossDots[i].set(g[crossKeys[i]]);
    for (const d of midDots.concat(crossDots)) d.show(true);

    for (const key of labelKeys) {
      labelsFor[key].set(g[key]);
      labelsFor[key].show(state.options.names);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        E: g.E, F: g.F, G: g.G, H: g.H,
        P: g.P, Q: g.Q, R: g.R, S: g.S,
        options: state.options, claims: g.claims, areas: g.areas,
      });
    }
  }

  for (const [box, key] of [[namesBox, "names"], [p1Box, "partition1"], [p2Box, "partition2"]]) {
    box.checked = state.options[key];
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
