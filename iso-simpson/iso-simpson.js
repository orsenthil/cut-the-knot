"use strict";

/*
 * The page for Iso Simpson: drawing and input only. The geometry lives in
 * iso-simpson-core.js. An SVG board holds the triangle ABC and the point P;
 * four draggable handles (pointer or arrow keys) move them. The isogonal
 * partner Q, the six pedal feet and their common circle are redrawn from the
 * core on every move. Three checkboxes reproduce the applet's switches —
 * "Perpendiculars to sides", "Circle" and "Angles" — and Reset restores the
 * opening picture.
 */

(function () {
  const Core = IsoSimpsonCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    triangle: board.layer("triangle"),
    rays: board.layer("rays"),
    angles: board.layer("angles"),
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

  // Every shape is made once and re-set on each redraw, so a handle keeps its
  // keyboard focus while the picture changes.
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);
  const cevians = ["PA", "PB", "PC"].map(() => board.segment(state.P, state.A, "cevian", layers.triangle));
  const outerCircle = board.circle(state.A, 10, "circumcircle", layers.circles);
  const pedalCircle = board.circle(state.A, 10, "pedal-circle", layers.circles);
  const simsonLine = board.line(state.A, state.B, "simson-line", layers.circles);
  const reflected = ["A", "B", "C"].map(() => board.segment(state.A, state.A, "reflected-ray", layers.rays));
  const angleMarks = Array.from({ length: 4 }, () => board.angleArc(state.A, state.B, state.C, 12,
    "angle-mark", layers.angles));
  const perpendiculars = Array.from({ length: 6 }, () =>
    board.segment(state.P, state.A, "perpendicular", layers.perpendiculars));
  const footDots = Array.from({ length: 6 }, () => board.point(state.A, "foot-dot", 3.6, layers.dots));
  const qDot = board.point(state.A, "q-dot", 5.5, layers.dots);
  const centerDot = board.point(state.A, "center-dot", 4, layers.dots);

  const labels = {};
  for (const name of ["A", "B", "C", "P", "Q"]) {
    labels[name] = board.label(state.A, name, "geom-label point-label", -16, -9, layers.labels);
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
    if (geometry.degenerate) return "Move the four points apart so the triangle can be drawn.";
    if (geometry.onCircumcircle) {
      return "P is on the circumcircle, so the three feet lie on one straight line: the Simson line.";
    }
    const Q = geometry.Q;
    if (!Q) return "Move P off the circumference to see its isogonal partner Q.";
    const M = geometry.center;
    return "Q is at (" + Math.round(Q.x) + ", " + Math.round(Q.y)
      + "). All six feet lie on one circle centred at the midpoint ("
      + Math.round(M.x) + ", " + Math.round(M.y) + ").";
  }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    const targets = [state.A, state.B, state.C];
    for (let i = 0; i < cevians.length; i++) cevians[i].set(state.P, targets[i]);
    for (const name of Core.NAMES) handles[name].set(state[name]);

    if (geometry.degenerate) {
      for (const shape of [outerCircle, pedalCircle, simsonLine, centerDot, qDot,
        ...reflected, ...angleMarks, ...perpendiculars, ...footDots]) shape.show(false);
      for (const name of Object.keys(labels)) labels[name].show(false);
      return;
    }

    // The circumcircle is the applet's red circle; on the Simson case it is
    // shown with the line through the first two feet.
    outerCircle.set(geometry.outer, geometry.outerRadius).show(state.showCircle);
    simsonLine.set(geometry.simson.a, geometry.simson.b)
      .show(state.showCircle && geometry.onCircumcircle);
    const circle = geometry.circleP;
    if (circle) pedalCircle.set(circle.center, circle.radius);
    pedalCircle.show(state.showCircle && !geometry.onCircumcircle && !!circle);
    centerDot.set(geometry.center || state.A).show(!!geometry.center);

    const rays = [geometry.rayA, geometry.rayB, geometry.rayC];
    const origins = [state.A, state.B, state.C];
    for (let i = 0; i < reflected.length; i++) {
      reflected[i].set(origins[i], rays[i]).show(state.showAngles);
    }
    const anglePairs = [
      { v: state.A, p: state.P, q: state.B, r: 13 },
      { v: state.A, p: state.P, q: geometry.rayA, r: 19 },
      { v: state.B, p: state.P, q: state.A, r: 13 },
      { v: state.B, p: state.P, q: geometry.rayB, r: 19 },
    ];
    for (let i = 0; i < angleMarks.length; i++) {
      const pair = anglePairs[i];
      angleMarks[i].set(pair.v, pair.p, pair.q, pair.r).show(state.showAngles);
    }

    const feet = geometry.onCircumcircle
      ? [geometry.feetP.a, geometry.feetP.b, geometry.feetP.c, null, null, null]
      : [geometry.feetP.a, geometry.feetP.b, geometry.feetP.c,
        geometry.feetQ.a, geometry.feetQ.b, geometry.feetQ.c];
    const sources = [state.P, state.P, state.P, geometry.Q, geometry.Q, geometry.Q];
    for (let i = 0; i < footDots.length; i++) {
      footDots[i].show(!!feet[i]);
      if (feet[i]) {
        footDots[i].set(feet[i]);
        perpendiculars[i].set(sources[i], feet[i]).show(state.showPerps);
      } else {
        perpendiculars[i].show(false);
      }
    }
    qDot.set(geometry.Q || state.P).show(!!geometry.Q);

    const at = {
      A: state.A, B: state.B, C: state.C, P: state.P,
      Q: geometry.Q || { x: -100, y: -100 },
    };
    for (const name of Object.keys(labels)) labels[name].set(at[name]).show(true);
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
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const checkboxes = {
    showPerps: document.getElementById("perpsBox"),
    showCircle: document.getElementById("circleBox"),
    showAngles: document.getElementById("anglesBox"),
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
