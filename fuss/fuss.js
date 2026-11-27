"use strict";

/*
 * Browser view of Fuss.  All the geometry lives in fuss-core.js; this file
 * only draws it with the shared Geom SVG helper and takes input.  The outer
 * circle is fixed, A is a draggable/focusable point on it, and the slider
 * moves the inner circle's centre.  The four tangents, the touching points
 * and the crossing P of the contact diagonals are rebuilt on every change.
 */

(() => {
  const Core = FussCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const slider = document.getElementById("distance");
  const dValue = document.getElementById("dValue");
  const namesBox = document.getElementById("names");
  const diagonalsBox = document.getElementById("diagonals");
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({
    radius: Core.DEFAULT_RADIUS,
    d: Core.DEFAULT_DISTANCE,
    angle: Core.DEFAULT_ANGLE,
  });
  slider.max = String(Core.maxDistance(state.radius));
  slider.value = String(state.d);
  dValue.value = String(state.d);
  let running = false;
  let frame = 0;

  // Back to front: circles, shapes, diagonals, dots, names, then the handle
  // (created last so it always keeps keyboard focus).
  const back = board.layer("circles");
  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const top = board.layer("handles");

  const outerCircle = board.circle(state.center, state.radius, "outer-circle", back);
  const innerCircle = board.circle(state.center, 1, "inner-circle", back);
  const quad = board.polygon([state.center], "quad", shapes);
  const contact = board.polygon([state.center], "contact", shapes);
  const diagonals = [
    board.segment(state.center, state.center, "diagonal", guides),
    board.segment(state.center, state.center, "diagonal", guides),
  ];
  const corners = [0, 1, 2].map(() => board.point(state.center, "corner", 3.5, dots));
  const touches = [0, 1, 2, 3].map(() => board.point(state.center, "touch", 2.8, dots));
  const outerCentre = board.point(state.center, "centre", 2.8, dots);
  const innerCentre = board.point(state.center, "centre", 2.8, dots);
  const cross = board.point(state.center, "cross", 3.5, dots);

  const labels = {};
  for (const key of ["A", "B", "C", "D", "K", "L", "M", "N", "P"]) {
    labels[key] = board.label(state.center, key, "point-label", 5, -6, names);
  }
  /** Put each label just outside its point, away from the circle's centre. */
  function labelOffset(p) {
    return [
      p.x >= state.center.x ? 4 : -9,
      p.y >= state.center.y ? 9 : -5,
    ];
  }

  const handle = board.handle("A", Core.onCircle(state, {
    x: state.center.x + state.radius * Math.cos(state.angle),
    y: state.center.y + state.radius * Math.sin(state.angle),
  }), {
    step: 2, shift: 10, r: 3.5, layer: top,
    label: "Point A. Drag it around the outer circle, or focus it and use the arrow keys.",
    clamp: (p) => Core.onCircle(state, p),
    describe: (p) => "on the outer circle at " + Math.round(p.x) + ", " + Math.round(p.y),
    onMove: (p) => { state = Core.movePoint(state, p); render(); },
  });

  /** `#status` is how the player's record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    slider.max = String(Core.maxDistance(state.radius));
    slider.value = String(state.d);
    dValue.value = String(state.d);
    namesBox.checked = state.names;
    diagonalsBox.checked = state.diagonals;

    if (!g) {
      say("This pair of circles cannot make a four-sided path.", Core.result(state));
      if (window.Track) window.Track.state(state);
      return;
    }

    outerCircle.set(g.outer.c, g.outer.r);
    innerCircle.set(g.inner.c, g.inner.r);
    quad.set(g.vertices);
    contact.set(g.touch);
    diagonals[0].set(g.touch[0], g.touch[2]);
    diagonals[1].set(g.touch[1], g.touch[3]);
    for (const d of diagonals) d.show(state.diagonals);
    corners.forEach((dot, i) => dot.set(g.vertices[i + 1]));
    touches.forEach((dot, i) => dot.set(g.touch[i]));
    outerCentre.set(g.outer.c);
    innerCentre.set(g.inner.c);
    cross.set(g.P);
    cross.show(state.diagonals);

    const where = {
      A: g.vertices[0], B: g.vertices[1], C: g.vertices[2], D: g.vertices[3],
      K: g.touch[0], L: g.touch[1], M: g.touch[2], N: g.touch[3], P: g.P,
    };
    handle.set(where.A);
    for (const key of Object.keys(labels)) {
      const offset = labelOffset(where[key]);
      labels[key].set(where[key], key, offset[0], offset[1]);
      labels[key].show(state.names || (key === "P" && state.diagonals));
    }

    say(Core.describe(state), Core.result(state));

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  slider.addEventListener("input", () => {
    state = Core.setDistance(state, Number(slider.value));
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  diagonalsBox.addEventListener("change", () => {
    state = Core.setOption(state, "diagonals", diagonalsBox.checked);
    render();
  });

  function tick() {
    if (!running) return;
    state = Core.move(state, { type: "turn", delta: 0.03490658503988659 });
    render();
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    startBtn.textContent = "Start";
    startBtn.setAttribute("aria-label", "Start moving corner A");
  }
  startBtn.addEventListener("click", () => {
    if (running) { stop(); return; }
    running = true;
    startBtn.textContent = "Stop";
    startBtn.setAttribute("aria-label", "Stop moving corner A");
    tick();
  });
  resetBtn.addEventListener("click", () => {
    stop();
    state = Core.reset(state);
    render();
  });

  // SVG colours are CSS classes, but the shared hook keeps the redraw path
  // identical on a site theme flip.
  board.onTheme(render);
  render();
})();
