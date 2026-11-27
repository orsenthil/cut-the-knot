"use strict";

/*
 * The page for Four Pedal Circles: drawing and input only. The geometry lives
 * in four-pedal-circles-core.js. An SVG board holds four points A, B, C, D, the
 * six joining lines and a fifth point P; five draggable handles (pointer or
 * arrow keys) move them. The four pedal circles and their common point Q are
 * redrawn from the core on every move. Three checkboxes reproduce the applet's
 * "names", "pedal triangles" and "perpendiculars" switches; Reset restores the
 * opening picture.
 */

(function () {
  const Core = FourPedalCirclesCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    sides: board.layer("sides"),
    triangles: board.layer("triangles"),
    perpendiculars: board.layer("perpendiculars"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const pairNames = ["AB", "AC", "AD", "BC", "BD", "CD"];
  const pairPoints = [["A", "B"], ["A", "C"], ["A", "D"], ["B", "C"], ["B", "D"], ["C", "D"]];
  const footKeys = ["ab", "ac", "ad", "bc", "bd", "cd"];

  // Objects are made once and re-set on each redraw, so a handle keeps its
  // keyboard focus while the picture changes.
  const sides = pairNames.map(() => board.segment(state.A, state.B, "side", layers.sides));
  const circles = Core.CIRCLE_NAMES.map((name) => board.circle(state.A, 10, "pedal-circle", layers.circles));
  const lines = Core.CIRCLE_NAMES.map((name) => board.line(state.A, state.B, "pedal-line", layers.circles));
  const triangles = Core.CIRCLE_NAMES.map((name) => board.polygon([state.A, state.B, state.C], "pedal-triangle", layers.triangles));
  const perpendiculars = footKeys.map(() => board.segment(state.P, state.A, "perpendicular", layers.perpendiculars));
  const footDots = footKeys.map(() => board.point(state.A, "foot-dot", 3.5, layers.dots));
  const qDot = board.point(state.A, "q-dot", 5.5, layers.dots);

  const labelOffsets = {
    A: [-16, -8], B: [-16, -8], C: [-16, -8], D: [-16, -8],
    P: [-16, -8], Q: [-16, -8],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 3,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => {
        const inside = Core.clampPoint(q);
        return Core.NAMES.some((other) => other !== which && Core.dist(inside, state[other]) < 12)
          ? state[which] : inside;
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p },
        "Moved " + which + " to (" + Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  function statusText() {
    if (geometry.degenerate) return "Move the points apart so the four triangles can be drawn.";
    const Q = geometry.Q;
    return "Q is at (" + Math.round(Q.x) + ", " + Math.round(Q.y) + "). All four pedal circles meet there.";
  }

  function draw() {
    geometry = Core.compute(state);
    for (let i = 0; i < sides.length; i++) {
      sides[i].set(state[pairPoints[i][0]], state[pairPoints[i][1]]).show(true);
    }
    for (const name of Core.NAMES) handles[name].set(state[name]);

    if (geometry.degenerate) {
      for (const shape of [...circles, ...lines, ...triangles, ...perpendiculars,
        ...footDots, qDot]) shape.show(false);
      for (const name of Object.keys(labels)) labels[name].show(false);
      return;
    }

    const { feet, circles: pedal, Q } = geometry;
    for (let i = 0; i < 4; i++) {
      const key = Core.CIRCLE_NAMES[i];
      const c = pedal[key];
      const isCircle = c.kind === "circle";
      // An almost straight pedal "circle" is drawn as the line the applet uses;
      // otherwise the circle is drawn even when its radius is very large.
      circles[i].show(isCircle);
      lines[i].show(!isCircle);
      if (isCircle) circles[i].set(c.center, c.radius);
      else lines[i].set(c.a, c.b);
      const tri = {
        ABC: ["ab", "bc", "ac"], ACD: ["ac", "cd", "ad"],
        ABD: ["ab", "bd", "ad"], BCD: ["bc", "cd", "bd"],
      }[key].map((f) => feet[f]);
      triangles[i].set(tri).show(state.showTriangles);
    }

    for (let i = 0; i < footKeys.length; i++) {
      footDots[i].set(feet[footKeys[i]]).show(true);
      perpendiculars[i].set(state.P, feet[footKeys[i]]).show(state.showLines);
    }
    qDot.set(Q).show(true);

    for (const name of Object.keys(labels)) {
      const at = ({ A: state.A, B: state.B, C: state.C, D: state.D, P: state.P, Q: Q })[name];
      labels[name].set(at).show(state.showNames);
    }
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      if (m.type === "point") handles[m.name].set(state[m.name]);
      say("That spot is too close to another point.");
      return false;
    }
    state = next;
    render();
    if (note) say(note, Core.result(state));
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showTriangles: document.getElementById("trianglesBox"),
    showLines: document.getElementById("linesBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    checkboxes[key].checked = state[key];
    checkboxes[key].addEventListener("change", () => {
      apply({ type: "option", key, value: checkboxes[key].checked },
        checkboxes[key].checked ? "Showing " + checkboxes[key].dataset.label + "."
          : "Hid " + checkboxes[key].dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening picture.");
  });

  // Classes carry the colours, so a theme flip needs no redraw of the maths;
  // recomputing here also keeps the SVG in step with any new CSS.
  board.onTheme(() => draw());

  render();
})();
