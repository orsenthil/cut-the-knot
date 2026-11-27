"use strict";

/*
 * Incenters in a Cyclic Quadrilateral — drawing and input only.  The geometry
 * is in cyclic-quadrilateral-core.js: four corners on one circle, the four
 * triangle incenters, their rectangle, the arc bisectors and the rhombus.
 * Every SVG object is created once and only updated on a redraw, so a handle
 * keeps keyboard focus.  The colours are CSS classes mapped by index.html to
 * the site's own custom properties.
 */

(function () {
  const Core = CyclicQuadrilateralCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");

  const boxes = {};
  for (const key of Core.OPTION_KEYS) boxes[key] = document.getElementById(key);
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const back = board.layer("circle");
  const shapeLayer = board.layer("shape");
  const guideLayer = board.layer("guides");
  const circleLayer = board.layer("incircles");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const circum = board.circle(Core.CENTER, Core.RADIUS, "circum", back);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", shapeLayer);
  const diagonals = [
    board.line(state.A, state.C, "diagonal", guideLayer),
    board.line(state.B, state.D, "diagonal", guideLayer),
  ];
  const rectangle = Array.from({ length: 4 }, () =>
    board.segment(state.A, state.B, "rectangle-side", guideLayer));
  const angleBisectors = Array.from({ length: 8 }, () =>
    board.segment(state.A, state.B, "angle-bisector", guideLayer));
  const rhombusLines = Array.from({ length: 4 }, () =>
    board.line(state.A, state.B, "rhombus-line", guideLayer));
  const arcLines = [
    board.segment(state.A, state.B, "arc-line", guideLayer),
    board.segment(state.C, state.D, "arc-line", guideLayer),
  ];
  const incircles = Array.from({ length: 4 }, () =>
    board.circle(state.A, 1, "incircle", circleLayer));
  const incenterDots = Array.from({ length: 4 }, () =>
    board.point(state.A, "incenter-dot", 4, dotLayer));
  const arcDots = Array.from({ length: 4 }, () =>
    board.point(state.A, "arc-dot", 4, dotLayer));

  const labelKeys = ["A", "B", "C", "D", "P", "Q", "R", "S", "IABC", "IACD", "IABD", "IBCD"];
  const labels = {};
  for (const key of labelKeys) labels[key] = board.label(state.A, key, "point-label", 9, -9, labelLayer);

  const handles = {};
  for (const key of Core.CORNERS) {
    handles[key] = board.handle(key, state[key], {
      step: 5, shift: 15, r: 9, layer: handleLayer,
      clamp: (p) => Core.clampToCircle(p),
      label: `Corner ${key}. Drag around the circle, or focus this corner and use the arrow keys.`,
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

  function hideAll(g) {
    quad.show(!!g);
    for (const s of diagonals.concat(rectangle, angleBisectors, rhombusLines,
      arcLines, incircles, incenterDots, arcDots)) s.show(false);
    for (const key of labelKeys) labels[key].show(false);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of Core.CORNERS) handles[key].set(state[key]);
    circum.set(Core.CENTER, Core.RADIUS);

    if (!g) {
      hideAll(null);
      say(Core.describe(state), Core.result(state));
      if (window.Track) window.Track.state({ A: state.A, B: state.B, C: state.C, D: state.D, options: state.options });
      return;
    }

    const o = state.options;
    quad.show(true).set([g.A, g.B, g.C, g.D]);
    diagonals[0].set(g.A, g.C).show(o.diagonals);
    diagonals[1].set(g.B, g.D).show(o.diagonals);
    g.rectangle.forEach(([p, q], i) => rectangle[i].set(p, q).show(o.rectangle));
    g.angleBisectors.forEach(([p, q], i) => angleBisectors[i].set(p, q).show(o.angleBisectors));
    g.rhombus.lines.forEach((l, i) => rhombusLines[i].set(l.p, l.q).show(o.rhombus));
    arcLines[0].set(g.P, g.Q).show(o.arcBisectors);
    arcLines[1].set(g.R, g.S).show(o.arcBisectors);

    [g.IABC, g.IACD, g.IABD, g.IBCD].forEach((p, i) => {
      incircles[i].set(p, g.radii[["ABC", "ACD", "ABD", "BCD"][i]]).show(o.incircles);
      incenterDots[i].set(p).show(o.incenters);
    });
    [g.P, g.Q, g.R, g.S].forEach((p, i) => arcDots[i].set(p).show(o.arcBisectors && o.names));

    for (const key of Core.CORNERS) labels[key].set(g[key], key).show(o.names);
    for (const [key, p] of [["P", g.P], ["Q", g.Q], ["R", g.R], ["S", g.S]]) {
      labels[key].set(p, key).show(o.arcBisectors && o.names);
    }
    for (const key of ["IABC", "IACD", "IABD", "IBCD"]) {
      labels[key].set(g[key], "I" + key.slice(1)).show(o.incenters && o.names);
    }

    say(Core.describe(state), Core.result(state));

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D, circle: g.circle,
        IABC: g.IABC, IACD: g.IACD, IABD: g.IABD, IBCD: g.IBCD,
        P: g.P, Q: g.Q, R: g.R, S: g.S, radii: g.radii,
        options: state.options, claims: g.claims,
      });
    }
  }

  for (const key of Core.OPTION_KEYS) {
    boxes[key].checked = state.options[key];
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
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
