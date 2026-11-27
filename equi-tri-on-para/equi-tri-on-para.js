"use strict";

/*
 * EquiTriOnPara — drawing and input only. The construction and the
 * parallelogram arithmetic are in equi-tri-on-para-core.js.
 *
 * Four handles A,B,C,D are the corners of the starting parallelogram. Moving
 * one recomputes the corner opposite it, just as the applet's mouseDragged
 * did. The eight equilateral tips X,Y,Z,W and P,Q,R,S are derived shapes:
 * they are redrawn, never dragged. The three checkboxes are the applet's
 * "names", "first step" and "second step" boxes; Reset is an exploration aid.
 * Every element is created once and updated in render(), so keyboard focus
 * stays on a handle after a redraw.
 */

(function () {
  const Core = EquiTriOnParaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const boxes = {
    names: document.getElementById("names"),
    first: document.getElementById("first"),
    second: document.getElementById("second"),
  };
  const resetBtn = document.getElementById("newBtn");

  let state = Core.start({});
  const initial = Object.assign({}, state, Core.geometry(state));

  /* Back to front: tinted triangles, their sides, the outlines, labels, dots. */
  const fills = board.layer("fills");
  const sides = board.layer("sides");
  const outlines = board.layer("outlines");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const firstTriangles = [];
  const secondTriangles = [];
  for (let i = 0; i < 4; i++) {
    firstTriangles.push(board.polygon([initial.A, initial.B, initial.X], "tri-fill-first", fills));
    secondTriangles.push(board.polygon([initial.X, initial.Y, initial.P], "tri-fill-second", fills));
  }
  const firstSides = [];
  const secondSides = [];
  for (let i = 0; i < 8; i++) {
    firstSides.push(board.segment(state.A, state.B, "tri-side-first", sides));
    secondSides.push(board.segment(state.A, state.B, "tri-side-second", sides));
  }
  const middle = board.polygon([state.A, state.B, state.C, state.D], "middle-outline", outlines);
  const finalOutline = board.polygon([state.A, state.B, state.C, state.D], "final-outline", outlines);
  const baseOutline = board.polygon([state.A, state.B, state.C, state.D], "base-outline", outlines);

  const labelled = Core.BASE.concat(Core.MID);
  const offsets = {
    A: [-16, -12], B: [-3, -13], C: [-3, -13], D: [-16, -12],
    X: [-3, -13], Y: [-3, -13], Z: [-3, -13], W: [-3, 19],
  };
  const nameNodes = {};
  for (const key of labelled) {
    nameNodes[key] = board.label(initial[key], key, "point-label", offsets[key][0], offsets[key][1], labels);
  }

  const handles = {};
  for (const key of Core.BASE) {
    handles[key] = board.handle(key, state[key], {
      r: 14, step: 5, shift: 15, layer: top,
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys; the opposite corner follows.`,
      clamp: (q, name) => Core.clampDrag(state, name, q),
      onMove: (q, name) => {
        state = Core.move(state, name, q);
        render();
      },
    });
  }

  /** #status is where the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const all = Object.assign({}, state, g);

    for (const key of Core.BASE) {
      handles[key].set(state[key]);
      nameNodes[key].set(state[key]);
    }
    for (const key of Core.MID) nameNodes[key].set(g[key]);
    for (const key of labelled) nameNodes[key].show(state.options.names);

    const firstSets = [
      [g.X, state.A, state.B], [g.Y, state.B, state.C],
      [g.Z, state.C, state.D], [g.W, state.D, state.A],
    ];
    const secondSets = [
      [g.P, g.X, g.Y], [g.Q, g.Y, g.Z],
      [g.R, g.Z, g.W], [g.S, g.W, g.X],
    ];
    for (let i = 0; i < 4; i++) {
      firstTriangles[i].set(firstSets[i]);
      firstTriangles[i].show(state.options.first);
      secondTriangles[i].set(secondSets[i]);
      secondTriangles[i].show(state.options.second);
    }
    /* Draw() puts the two sides of each triangle in this order. */
    const firstSegments = [
      [g.X, state.A], [g.X, state.B], [g.Y, state.B], [g.Y, state.C],
      [g.Z, state.C], [g.Z, state.D], [g.W, state.D], [g.W, state.A],
    ];
    const secondSegments = [
      [g.P, g.X], [g.P, g.Y], [g.Q, g.Y], [g.Q, g.Z],
      [g.R, g.Z], [g.R, g.W], [g.S, g.W], [g.S, g.X],
    ];
    for (let i = 0; i < 8; i++) {
      firstSides[i].set(firstSegments[i][0], firstSegments[i][1]);
      secondSides[i].set(secondSegments[i][0], secondSegments[i][1]);
    }
    middle.set([g.X, g.Y, g.Z, g.W]);
    finalOutline.set([g.P, g.Q, g.R, g.S]);
    baseOutline.set([state.A, state.B, state.C, state.D]);

    say(Core.describe(state), state.explored ? "done" : null);

    /* Board units, not screen pixels, for the player's record and the tutor. */
    if (window.Track) {
      window.Track.state({
        A: all.A, B: all.B, C: all.C, D: all.D,
        X: all.X, Y: all.Y, Z: all.Z, W: all.W,
        P: all.P, Q: all.Q, R: all.R, S: all.S,
        options: {
          names: state.options.names,
          first: state.options.first,
          second: state.options.second,
        },
        claims: {
          middleParallelogram: g.middleParallelogram,
          lastParallelogram: g.lastParallelogram,
          coincide: g.coincide,
        },
      });
    }
  }

  for (const key of Object.keys(boxes)) {
    const box = boxes[key];
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

  /* Colours are CSS classes, so a theme flip needs no recompute; the shared
   * hook is still wired for ports that draw from JavaScript. */
  board.onTheme(render);
  render();
})();
