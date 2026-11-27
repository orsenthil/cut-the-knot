"use strict";

/*
 * de Villiers — drawing and input only.  The geometry is in
 * de-villiers-core.js: four similar triangles on the sides of a movable
 * quadrilateral, and the parallelogram PQRS they always make.
 *
 * The four corners A,B,C,D and the four apexes P,Q,R,S are real focusable
 * Geom handles.  Dragging a corner keeps the common turn and scale and moves
 * the apexes; dragging an apex changes that turn and scale and moves the
 * other three apexes.  The three checkboxes match the applet's Show names,
 * Show parallelogram and Show angles.  Shapes are built once and updated on
 * a redraw, so a handle keeps keyboard focus after the computer redraws.
 */

(function () {
  const Core = DeVilliersCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nameBox = document.getElementById("names");
  const paraBox = document.getElementById("para");
  const angleBox = document.getElementById("angles");
  const resetBtn = document.getElementById("newBtn");

  let state = Core.start({});

  /* Layers, back to front. */
  const guides = board.layer("guides");
  const para = board.layer("parallelogram");
  const angleLayer = board.layer("angles");
  const labels = board.layer("labels");
  const top = board.layer("handles");

  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", guides);
  /* Draw(): A-P, B-P, B-Q, C-Q, C-R, D-R, D-S, A-S. */
  const triangleSides = [];
  for (let i = 0; i < 8; i++) {
    triangleSides.push(board.segment(state.A, state.B, "tri-side", guides));
  }
  const paraShape = board.polygon([state.P, state.Q, state.R, state.S], "para", para);

  /* ShowAnglesInTriangle draws three arcs per triangle, at X, Y and apex. */
  const arcs = [];
  for (let i = 0; i < 12; i++) {
    arcs.push(board.angleArc(state.A, state.B, state.C, 17, "angle-arc", angleLayer));
  }

  const names = Core.BASE.concat(Core.APEX);
  const offsets = {
    A: [-17, -10], B: [9, -10], C: [9, -10], D: [-17, -10],
    P: [-17, -10], Q: [9, -2], R: [9, -2], S: [-17, -10],
  };
  const labelNodes = {};
  for (const key of names) {
    const d = offsets[key];
    labelNodes[key] = board.label(state[key], key, "point-label", d[0], d[1], labels);
  }

  const handleOptions = {
    step: 5, shift: 15, r: 9, layer: top,
    clamp: (p) => Core.clamp(p),
  };
  const handles = {};
  for (const key of Core.BASE) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }
  for (const key of Core.APEX) {
    handles[key] = board.handle(key, state[key], Object.assign({}, handleOptions, {
      cls: "geom-handle apex-handle",
      label: `Apex ${key}. Drag it, or focus it and use the arrow keys to change the triangle angle.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    }));
  }

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of names) {
      handles[key].set(state[key]);
      labelNodes[key].set(state[key]);
      labelNodes[key].show(state.options.names);
    }

    quad.set([state.A, state.B, state.C, state.D]);
    const pairs = [
      ["A", "P"], ["B", "P"], ["B", "Q"], ["C", "Q"],
      ["C", "R"], ["D", "R"], ["D", "S"], ["A", "S"],
    ];
    for (let i = 0; i < pairs.length; i++) {
      triangleSides[i].set(state[pairs[i][0]], state[pairs[i][1]]);
    }

    if (g) {
      paraShape.set([g.P, g.Q, g.R, g.S]);
      paraShape.show(state.options.para);
      for (let i = 0; i < g.arcs.length; i++) {
        const a = g.arcs[i];
        arcs[i].set(a.vertex, a.p, a.q, a.r);
        arcs[i].show(state.options.angles);
      }
    } else {
      paraShape.show(false);
      for (const a of arcs) a.show(false);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    /* The position, in board units, for the player's record and the tutor. */
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D,
        P: state.P, Q: state.Q, R: state.R, S: state.S,
        alpha: state.alpha, coef: state.coef,
        options: {
          names: state.options.names,
          para: state.options.para,
          angles: state.options.angles,
        },
        claims: g ? g.claims : null,
      });
    }
  }

  for (const [box, key] of [[nameBox, "names"], [paraBox, "para"], [angleBox, "angles"]]) {
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

  /* SVG colours are CSS classes, so a theme flip needs no recompute; redraw
   * anyway to keep the hook the shared Geom helper provides. */
  board.onTheme(render);
  render();
})();
