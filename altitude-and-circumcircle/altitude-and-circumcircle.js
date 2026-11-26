"use strict";

/*
 * The page for Altitude And Circumcircle: drawing and input only. The geometry
 * lives in altitude-and-circumcircle-core.js. An SVG board holds the triangle
 * and its circumcircle; the three corners are draggable dots (Geom handles), so
 * a pointer or the arrow keys can put the triangle anywhere. Four checkboxes
 * reproduce the applet's "hint", "names", "altitudes" and "extra circle"
 * switches, and Reset brings back the opening picture.
 */

(function () {
  const Core = AltitudeAndCircumcircleCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    guides: board.layer("guides"),
    triangle: board.layer("triangle"),
    marks: board.layer("marks"),
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

  /* The objects are made once and re-set on every redraw, so a handle keeps
     its keyboard focus while the rest of the picture changes. */
  const circum = board.circle({ x: 180, y: 120 }, 72, "circumcircle", layers.circles);
  const extra = board.circle({ x: 180, y: 120 }, 72, "extracircle", layers.circles);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);

  const altitudes = ["a", "b", "c"].map((key) =>
    board.line(state[key.toUpperCase()], { x: 180, y: 120 }, "altitude", layers.guides));
  const rightAngles = ["a", "b", "c"].map(() =>
    board.rightAngle({ x: 180, y: 120 }, state.A, state.B, 7, "rightmark", layers.marks));
  const hintLines = [0, 1, 2].map(() => board.segment(state.A, state.B, "hintline", layers.marks));
  const sLine = board.segment({ x: 180, y: 120 }, state.A, "extraseg", layers.marks);

  const centerDot = board.point({ x: 180, y: 120 }, "centerdot", 3, layers.dots);
  const Hdot = board.point({ x: 180, y: 120 }, "orthodot", 4.5, layers.dots);
  const footDots = [0, 1, 2].map(() => board.point(state.A, "footdot", 3.5, layers.dots));
  const refDots = [0, 1, 2].map(() => board.point(state.A, "reflectdot", 5, layers.dots));
  const Sdot = board.point(state.A, "reflectdot", 5, layers.dots);

  const labelOffsets = {
    A: [-4, -12], B: [-6, 18], C: [9, 3], H: [-6, -10],
    Ha: [7, 16], Hb: [8, -9], Hc: [-19, -9],
    Ka: [7, -8], Kb: [8, -8], Kc: [-20, -8], S: [7, 16],
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
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => {
        const inside = {
          x: Math.max(6, Math.min(Core.WIDTH - 6, q.x)),
          y: Math.max(6, Math.min(Core.HEIGHT - 6, q.y)),
        };
        return Core.NAMES.some((other) => other !== which && Core.dist(inside, state[other]) < 12)
          ? state[which] : inside;
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p },
        "Moved corner " + which + " to (" + Math.round(p.x) + ", " + Math.round(p.y) + ")."),
    });
  }

  function statusText() {
    if (geometry.degenerate) {
      return "Put the three corners apart so they make a triangle.";
    }
    const r = Core.residuals(state, geometry);
    if (r && r.concyclic < 1e-6) {
      return "Ka, Kb and Kc all sit on the circle. Each foot is halfway between H and its reflection.";
    }
    return "Drag a corner to move the triangle and its circle.";
  }

  function show(shape, on) { shape.show(on); return shape; }
  function showLabel(name, on) { labels[name].show(on && state.showNames); }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    for (const name of Core.NAMES) handles[name].set(state[name]);

    if (geometry.degenerate) {
      for (const shape of [circum, extra, centerDot, Hdot, sLine, ...altitudes,
        ...rightAngles, ...hintLines, ...footDots, ...refDots, Sdot]) show(shape, false);
      for (const name of Object.keys(labels)) showLabel(name, false);
      return;
    }

    const { O, r, H, S, feet, refs, circleHBC } = geometry;
    circum.set(O, r).show(true);
    centerDot.set(O).show(true);
    Hdot.set(H).show(true);

    const pts = { a: state.A, b: state.B, c: state.C };
    for (let i = 0; i < 3; i++) {
      const key = ["a", "b", "c"][i];
      altitudes[i].set(pts[key], feet[key]).show(state.showAltitudes);
      const side = { a: [state.B, state.C], b: [state.A, state.C], c: [state.A, state.B] }[key];
      rightAngles[i].set(feet[key], side[0], side[1], 7).show(state.showAltitudes);
      // The applet always marks Ha and Ka; Hb, Hc, Kb, Kc come with altitudes.
      footDots[i].set(feet[key]).show(i === 0 || state.showAltitudes);
      refDots[i].set(refs[key]).show(i === 0 || state.showAltitudes);
      hintLines[i].set(H, refs[key]).show(state.showHint);
    }

    extra.show(state.showCircle && !!circleHBC);
    sLine.show(state.showCircle);
    Sdot.show(state.showCircle);
    if (circleHBC) {
      extra.set(circleHBC.center, circleHBC.radius);
      sLine.set(feet.a, S);
      Sdot.set(S);
    }

    showLabel("A", true); showLabel("B", true); showLabel("C", true);
    showLabel("H", true); showLabel("Ha", true); showLabel("Ka", true);
    showLabel("Hb", state.showAltitudes); showLabel("Hc", state.showAltitudes);
    showLabel("Kb", state.showAltitudes); showLabel("Kc", state.showAltitudes);
    showLabel("S", state.showCircle);
    for (const name of Object.keys(labels)) labels[name].set(
      ({ A: state.A, B: state.B, C: state.C, H: H, Ha: feet.a, Hb: feet.b, Hc: feet.c,
        Ka: refs.a, Kb: refs.b, Kc: refs.c, S: S })[name]);
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
      say("That spot is too close to another corner.");
      return false;
    }
    state = next;
    render();
    if (note) say(note, Core.result(state));
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showHint: document.getElementById("hintBox"),
    showAltitudes: document.getElementById("altitudesBox"),
    showCircle: document.getElementById("circleBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    checkboxes[key].checked = state[key];
    checkboxes[key].addEventListener("change", () => {
      apply({ type: "option", key, value: checkboxes[key].checked },
        checkboxes[key].checked ? "Showing " + checkboxes[key].dataset.label + "." : "Hid " + checkboxes[key].dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening triangle and circle.");
  });

  // Colours are CSS classes, so a theme flip only needs a redraw of the SVG.
  board.onTheme(() => draw());

  render();
})();
