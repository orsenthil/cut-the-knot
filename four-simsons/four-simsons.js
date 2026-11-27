"use strict";

/*
 * Four Simsons — drawing and input only.  The geometry lives in
 * four-simsons-core.js: four handles constrained to one circle, the four
 * nine-point circles and centres, and the four Simson lines.  Clicking (or
 * focusing and pressing Enter on) a Simson line shows the triangle behind it
 * and the three perpendicular feet, just as the applet's Highlight() does;
 * clicking elsewhere clears it.  Shapes are created once and only updated on
 * a redraw, so a focused handle or line keeps keyboard focus.
 */

(function () {
  const Core = FourSimsonsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {
    centers: document.getElementById("centersBox"),
    circles: document.getElementById("circlesBox"),
    simsons: document.getElementById("simsonsBox"),
  };

  let state = Core.start();

  /* Layers, back to front. */
  const base = board.layer("base");
  const nineCircles = board.layer("nine-circles");
  const lines = board.layer("simson-lines");
  const highlight = board.layer("highlight");
  const centers = board.layer("centers");
  const labels = board.layer("labels");
  const handles = board.layer("handles");

  const circum = board.circle(Core.CENTER, Core.RADIUS, "circum", base);
  const quad = board.polygon(Core.START_ANGLES.map(Core.onCircle), "quad", base);

  const circles = [0, 1, 2, 3].map(() => board.circle(Core.CENTER, 1, "nine-circle", nineCircles));
  const simsons = [0, 1, 2, 3].map((i) => {
    const line = board.segment(Core.CENTER, Core.CENTER, "simson", lines);
    line.node.setAttribute("tabindex", "0");
    line.node.setAttribute("role", "button");
    line.node.setAttribute("aria-label",
      `Simson line of ${Core.NAMES[i]}. Press Enter to show its triangle and three perpendicular feet.`);
    return line;
  });

  const sides = [0, 1, 2].map(() => board.segment(Core.CENTER, Core.CENTER, "highlight-side", highlight));
  const perps = [0, 1, 2].map(() => board.segment(Core.CENTER, Core.CENTER, "perp", highlight));
  const feet = [0, 1, 2].map(() => board.point(Core.CENTER, "foot", 4, highlight));
  const centerDots = [0, 1, 2, 3].map(() => board.point(Core.CENTER, "nine-center", 4, centers));
  const cornerLabels = Core.NAMES.map((name) => board.label(Core.CENTER, name, "point-label", 0, 0, labels));

  const handleOptions = {
    step: 3, shift: 12, r: 9, layer: handles,
    clamp: (p) => Core.projectToCircle(p),
    label: "Corner. Drag it, or focus it and use the arrow keys to move it round the circle.",
    describe: (p) => `At ${Math.round(Core.angleOf(p) * 180 / Math.PI)} degrees on the circle.`,
  };
  const pointHandles = {};
  for (const name of Core.NAMES) {
    pointHandles[name] = board.handle(name, Core.onCircle(Core.START_ANGLES[Core.NAMES.indexOf(name)]),
      Object.assign({}, handleOptions, {
        label: `Corner ${name}. Drag it, or focus it and use the arrow keys to move it round the circle.`,
        onMove: (p, which) => {
          state = Core.move(state, which, p);
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
    for (const name of Core.NAMES) pointHandles[name].set(Core.onCircle(state.angles[Core.NAMES.indexOf(name)]));
    circum.show(true);

    if (!g) {
      quad.show(false);
      for (const s of circles.concat(simsons, sides, perps, feet, centerDots, cornerLabels)) s.show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      if (window.Track) window.Track.state({ angles: state.angles.slice(), options: state.options, selected: state.selected, points: null });
      return;
    }

    quad.show(true).set(g.points);
    for (let i = 0; i < 4; i++) {
      circles[i].set(g.circles[i].center, g.circles[i].radius).show(state.options.circles);
      centerDots[i].set(g.centers[i]).show(state.options.centers);
      const s = g.simsons[i];
      simsons[i].set(s.first, s.second).show(state.options.simsons);
      simsons[i].node.classList.toggle("selected", state.selected === i);
      const at = g.points[i], dx = at.x - Core.CENTER.x, dy = at.y - Core.CENTER.y;
      const n = Math.hypot(dx, dy) || 1;
      cornerLabels[i].set(at, Core.NAMES[i], (dx / n) * 14 - 4, (dy / n) * 14 + 4).show(true);
    }

    const on = state.options.simsons && state.selected >= 0;
    const tri = on ? g.triangles[state.selected] : null;
    const point = on ? g.points[state.selected] : null;
    for (let i = 0; i < 3; i++) {
      if (on) {
        sides[i].set(tri[i], tri[(i + 1) % 3]);
        perps[i].set(point, g.simsons[state.selected].feet[i]);
        feet[i].set(g.simsons[state.selected].feet[i]);
      }
      sides[i].show(on);
      perps[i].show(on);
      feet[i].show(on);
    }

    say(Core.describe(state), state.explored ? "done" : null);

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: g.A, B: g.B, C: g.C, D: g.D,
        centers: g.centers, orthocenters: g.orthocenters,
        circles: g.circles.map((c) => ({ center: c.center, radius: c.radius })),
        simsonLines: g.simsons.map((s) => [s.first, s.second]),
        H: g.H, circumcenter: g.circumcenter, circumradius: g.circumradius,
        options: Object.assign({}, state.options), selected: state.selected,
        claims: g.claims, measures: g.measures,
      });
    }
  }

  /* Clicking a line highlights it; clicking the empty board clears it. */
  for (let i = 0; i < 4; i++) {
    const select = () => { state = Core.select(state, state.selected === i ? -1 : i); render(); };
    simsons[i].node.addEventListener("click", (e) => { e.stopPropagation(); select(); });
    simsons[i].node.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      select();
    });
  }
  board.root.addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest(".simson, .geom-handle")) return;
    if (state.selected !== -1) { state = Core.select(state, -1); render(); }
  });

  for (const name of Object.keys(boxes)) {
    boxes[name].checked = state.options[name];
    boxes[name].addEventListener("change", () => {
      state = Core.setOption(state, name, boxes[name].checked);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    for (const name of Object.keys(boxes)) boxes[name].checked = state.options[name];
    render();
  });

  board.onTheme(render);
  render();
})();
