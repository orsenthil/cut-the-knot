"use strict";

/*
 * Miquel — the drawing and input, with all the geometry in miquel-core.js.
 * The triangle's corners A, B, C and the three marked points X, Y, Z are
 * draggable and focusable. The three circles, the Miquel point P, the orange
 * simson line and (only when X, Y, Z line up) the red circumcircle are redrawn
 * from the core on every move. Geom keeps pointer coordinates in viewBox units
 * and keeps arrow-key focus on the handle a player is using.
 */

(function () {
  const Core = MiquelCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const lineUpBtn = document.getElementById("lineUpBtn");

  let state = Core.start({});

  /* Layers, back to front. Handles stay on top so keyboard focus survives. */
  const back = board.layer("back");
  const sides = board.layer("sides");
  const guides = board.layer("guides");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const circum = board.circle(state.vertices[0], 1, "circum", back);
  const circles = [
    board.circle(state.vertices[0], 1, "miquel-circle", back),
    board.circle(state.vertices[0], 1, "miquel-circle", back),
    board.circle(state.vertices[0], 1, "miquel-circle", back),
  ];
  const sideLines = [
    board.line(state.vertices[1], state.vertices[2], "side-line", sides),
    board.line(state.vertices[0], state.vertices[2], "side-line", sides),
    board.line(state.vertices[0], state.vertices[1], "side-line", sides),
  ];
  const edges = [
    board.segment(state.vertices[0], state.vertices[1], "side", sides),
    board.segment(state.vertices[1], state.vertices[2], "side", sides),
    board.segment(state.vertices[2], state.vertices[0], "side", sides),
  ];
  const simson = board.line(state.vertices[0], state.vertices[1], "simson", guides);
  const pDot = board.point(state.vertices[0], "miquel-dot", 5, dots);

  const labels = {};
  for (const key of ["A", "B", "C", "X", "Y", "Z", "P"]) {
    const isCorner = "ABC".indexOf(key) >= 0;
    labels[key] = board.label(state.vertices[0], key, "point-label",
      isCorner ? -15 : 8, key === "P" ? 19 : -10, names);
  }

  /* Moving a corner keeps each marked point at the same fraction of its side;
   * moving a marked point projects it onto its side line (extensions included). */
  const handleOptions = {
    step: 5, shift: 15, r: 8, layer: top,
    clamp: (p) => Core.clampPoint(p),
  };
  const mkHandle = (name, p, label, onMove) => board.handle(name, p,
    Object.assign({}, handleOptions, {
      label: label,
      onMove: onMove,
    }));

  const handles = {
    A: mkHandle("A", state.vertices[0],
      "Corner A. Drag it, or focus it and use the arrow keys, to move the triangle.",
      (p, name) => { state = Core.moveVertex(state, 0, p); render(); }),
    B: mkHandle("B", state.vertices[1],
      "Corner B. Drag it, or focus it and use the arrow keys, to move the triangle.",
      (p, name) => { state = Core.moveVertex(state, 1, p); render(); }),
    C: mkHandle("C", state.vertices[2],
      "Corner C. Drag it, or focus it and use the arrow keys, to move the triangle.",
      (p, name) => { state = Core.moveVertex(state, 2, p); render(); }),
    X: mkHandle("X", Core.sidePoints(state)[0],
      "Point X on the side opposite A. Drag it, or use the arrow keys, to slide along that side line.",
      (p, name) => { state = Core.moveSidePoint(state, 0, p); render(); }),
    Y: mkHandle("Y", Core.sidePoints(state)[1],
      "Point Y on the side opposite B. Drag it, or use the arrow keys, to slide along that side line.",
      (p, name) => { state = Core.moveSidePoint(state, 1, p); render(); }),
    Z: mkHandle("Z", Core.sidePoints(state)[2],
      "Point Z on the side opposite C. Drag it, or use the arrow keys, to slide along that side line.",
      (p, name) => { state = Core.moveSidePoint(state, 2, p); render(); }),
  };

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    const m = Core.sidePoints(state);
    const v = state.vertices;

    handles.A.set(v[0]);
    handles.B.set(v[1]);
    handles.C.set(v[2]);
    handles.X.set(m[0]);
    handles.Y.set(m[1]);
    handles.Z.set(m[2]);

    if (!g) {
      for (const c of circles) c.show(false);
      circum.show(false);
      simson.show(false);
      pDot.show(false);
      for (const key of Object.keys(labels)) labels[key].show("ABC".indexOf(key) >= 0);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state(state);
      return;
    }

    for (let i = 0; i < 3; i++) circles[i].set(g.circles[i].c, g.circles[i].r).show(true);
    circum.set(g.circum.c, g.circum.r).show(g.simson.collinear);
    simson.set(g.side[g.simson.pair ? g.simson.pair[0] : 0],
               g.side[g.simson.pair ? g.simson.pair[1] : 1]).show(!!g.simson.pair);
    pDot.set(g.point).show(true);

    for (let i = 0; i < 3; i++) {
      sideLines[i].set(Core.ends(v, i)[0], Core.ends(v, i)[1]);
    }
    edges[0].set(v[0], v[1]);
    edges[1].set(v[1], v[2]);
    edges[2].set(v[2], v[0]);

    labels.A.set(v[0]);
    labels.B.set(v[1]);
    labels.C.set(v[2]);
    labels.X.set(m[0]);
    labels.Y.set(m[1]);
    labels.Z.set(m[2]);
    labels.P.set(g.point);
    for (const key of Object.keys(labels)) labels[key].show(true);

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        vertices: v, t: state.t, side: m, circles: g.circles,
        point: g.point, circum: g.circum, simson: g.simson.pair,
        explored: state.explored,
      });
    }
  }

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });
  lineUpBtn.addEventListener("click", () => {
    state = Core.makeCollinear(state);
    render();
  });

  // SVG colours are CSS classes, so a theme flip needs no recompute; redraw
  // anyway to keep the hook the shared Geom helper provides.
  board.onTheme(render);
  render();
})();
