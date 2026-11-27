"use strict";

/*
 * The page for Foot Of Altitude: drawing and input only. The geometry is in
 * foot-of-altitude-core.js. An SVG board holds the triangle, the sliding point D
 * and its two perpendiculars; E, F and the circle with diameter AD are redrawn
 * from the core. Four handles are draggable and take the arrow keys. The three
 * checkboxes and Reset are the switches the applet offers.
 */

(function () {
  const Core = FootOfAltitudeCore;
  const statusEl = document.getElementById("status");
  const measureEl = document.getElementById("measure");
  const board = Geom.board("board");

  const layers = {
    guides: board.layer("guides"),
    circle: board.layer("circle"),
    triangle: board.layer("triangle"),
    perpendiculars: board.layer("perpendiculars"),
    marks: board.layer("marks"),
    bars: board.layer("bars"),
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

  /* Each shape is made once and only re-set on a redraw, so keyboard focus on
     a handle survives every move. */
  const baseLine = board.line(state.B, state.C, "baseLine", layers.guides);
  const altitude = board.segment(state.A, state.D, "altitude", layers.guides);
  const circle = board.circle(state.A, 1, "circumcircle", layers.circle);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.triangle);
  const de = board.segment(state.D, state.A, "perpendicular", layers.perpendiculars);
  const df = board.segment(state.D, state.A, "perpendicular", layers.perpendiculars);
  const ef = board.segment(state.A, state.A, "ef", layers.perpendiculars);
  const rightAngles = [0, 1, 2, 3].map(() =>
    board.rightAngle(state.A, state.B, state.C, 7, "rightmark", layers.marks));
  const footAngles = [0, 1].map(() =>
    board.rightAngle(state.D, state.A, state.B, 7, "rightmark", layers.marks));
  const barMin = board.segment({ x: 10, y: 244 }, { x: 10, y: 244 }, "barMin", layers.bars);
  const barNow = board.segment({ x: 10, y: 238 }, { x: 10, y: 238 }, "barNow", layers.bars);
  const footDot = board.point(state.D, "footdot", 4, layers.dots);
  const eDot = board.point(state.A, "projectiondot", 3.5, layers.dots);
  const fDot = board.point(state.A, "projectiondot", 3.5, layers.dots);

  const labelOffsets = {
    A: [-4, -10], B: [-13, 16], C: [6, 16], D: [-4, 16],
    E: [7, -6], F: [-15, -6], H: [10, -12],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  function clampHandle(q, which) {
    const p = Core.clampPoint(q);
    // B, C and D are fixed to the horizontal base line, as in the applet.
    if (Core.HORIZONTAL.includes(which)) p.y = state[which].y;
    return p;
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 2,
      shift: 5,
      cls: "geom-handle",
      layer: layers.handles,
      label: "Point " + name + ". Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: clampHandle,
      onMove: (p, which) => apply({ type: "point", name: which, point: p }),
    });
  }

  function statusText() {
    if (geometry.degenerate) return "Move A off the base line so the three corners make a triangle.";
    if (geometry.finished) {
      return "D is at the foot of the altitude: EF is shortest, at "
        + geometry.minLength.toFixed(1) + " board units.";
    }
    return "EF is " + geometry.ef.toFixed(1) + " units; the shortest is "
      + geometry.minLength.toFixed(1) + ", at the foot of the altitude.";
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw() {
    geometry = Core.compute(state);
    triangle.set([state.A, state.B, state.C]);
    baseLine.set(state.B, state.C);
    for (const name of Core.NAMES) handles[name].set(state[name]);

    if (geometry.degenerate) {
      for (const shape of [altitude, circle, de, df, ef, ...rightAngles, ...footAngles,
        footDot, eDot, fDot, barMin, barNow]) show(shape, false);
      for (const name of Object.keys(labels)) show(labels[name], false);
      measureEl.textContent = "";
      return;
    }

    const { E, F, D0, minLength, ef: efLength, circle: circum } = geometry;
    de.set(state.D, E);
    df.set(state.D, F);
    ef.set(E, F).show(true);
    barMin.set({ x: 10, y: 244 }, { x: 10 + minLength, y: 244 }).show(true);
    barNow.set({ x: 10, y: 238 }, { x: 10 + geometry.ef, y: 238 })
      .node.setAttribute("class", geometry.finished ? "barNow done" : "barNow");
    show(barNow, true);
    measureEl.textContent = "Green bar: shortest " + minLength.toFixed(1)
      + " units. Violet bar: EF now " + efLength.toFixed(1) + " units.";

    show(altitude, state.showHint);
    altitude.set(state.A, state.D);
    if (circum) circle.set(circum.center, circum.radius);
    show(circle, !!state.showHint && !!circum);
    show(footDot, state.showHint || geometry.finished);
    footDot.set(D0);
    eDot.set(E);
    fDot.set(F);
    show(eDot, true);
    show(fDot, true);

    const rmarks = [
      [E, state.D, state.A], [E, state.D, state.C],
      [F, state.D, state.A], [F, state.D, state.B],
    ];
    rmarks.forEach((m, i) => {
      rightAngles[i].set(m[0], m[1], m[2], 7).show(state.showPremise);
    });
    footAngles[0].set(state.D, state.A, state.B, 7).show(state.showHint && geometry.finished);
    footAngles[1].set(state.D, state.A, state.C, 7).show(state.showHint && geometry.finished);

    const at = {
      A: state.A, B: state.B, C: state.C, D: state.D,
      E: E, F: F, H: D0,
    };
    for (const name of Object.keys(labels)) {
      labels[name].set(at[name]);
      show(labels[name], state.showNames && (name !== "H" || (state.showHint || geometry.finished)));
    }
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render() {
    draw();
    say(statusText(), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply a core move; an illegal one puts the handle back where it was. */
  function apply(m) {
    const next = Core.move(state, m);
    if (!next) {
      if (m.type === "point") handles[m.name].set(state[m.name]);
      say("That spot is too close to another point.");
      return false;
    }
    state = next;
    render();
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showPremise: document.getElementById("premiseBox"),
    showHint: document.getElementById("hintBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    checkboxes[key].checked = state[key];
    checkboxes[key].addEventListener("change", () => {
      apply({ type: "option", key, value: checkboxes[key].checked });
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" });
  });

  // Colours are CSS classes, so a theme flip only needs the geometry refreshed.
  board.onTheme(() => draw());

  render();
})();
