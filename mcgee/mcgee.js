"use strict";

/*
 * The page for Ian McGee's observation: drawing and input only. The geometry
 * is in mcgee-core.js. An SVG board holds the circle, the two equal tangents
 * AP and BQ and the chord AB; A and B are draggable Geom handles clamped to
 * the circle, the slider reproduces the applet's -200..200 length scrollbar,
 * and the four checkboxes reproduce its names / statement / premise / hint
 * switches. When the applet's Compute() pauses (short tangent or A and B
 * closer than two pixels) we keep the last drawn figure, just as it does.
 */

(function () {
  const Core = McgeeCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circle: board.layer("circle"),
    premise: board.layer("premise"),
    tangents: board.layer("tangents"),
    statement: board.layer("statement"),
    hint: board.layer("hint"),
    ticks: board.layer("ticks"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();
  let geometry = Core.compute(state);
  let lastDrawable = geometry.valid && geometry.drawable ? geometry : null;

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Every shape is made once and re-set on each redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const givenCircle = board.circle(state.A, Core.RADIUS, "given-circle", layers.circle);
  const radii = [
    board.segment(Core.CENTER, state.A, "radius", layers.premise),
    board.segment(Core.CENTER, state.B, "radius", layers.premise),
  ];
  const rightAngles = [
    board.rightAngle(state.A, Core.CENTER, state.A, 11, "rightmark", layers.premise),
    board.rightAngle(state.B, Core.CENTER, state.B, 11, "rightmark", layers.premise),
  ];
  const tangents = [
    board.segment(state.A, state.A, "tangent", layers.tangents),
    board.segment(state.B, state.B, "tangent", layers.tangents),
  ];
  const chord = board.segment(state.A, state.B, "chord", layers.statement);
  const crossSegment = board.segment(state.A, state.B, "cross-segment", layers.statement);
  const hintLines = [
    board.segment(state.A, state.A, "hintline", layers.hint),
    board.segment(state.A, state.A, "hintline", layers.hint),
  ];
  const angleMarks = [
    board.angleArc(state.A, state.A, state.B, 20, "anglemark", layers.hint),
    board.angleArc(state.A, state.A, state.B, 27, "anglemark", layers.hint),
  ];
  // One tick on each equal tangent (AP, BQ, AR), two on each half of PQ.
  const equalTicks = [0, 1, 2].map(() => board.segment(state.A, state.A, "tick", layers.ticks));
  const halfTicks = [0, 1, 2, 3].map(() => board.segment(state.A, state.A, "tick double", layers.ticks));
  const dots = {
    P: board.point(state.A, "claimdot", 4.5, layers.dots),
    S: board.point(state.A, "claimdot", 4.5, layers.dots),
    Q: board.point(state.A, "claimdot", 4.5, layers.dots),
    O: board.point(state.A, "centredot", 3.5, layers.dots),
    R: board.point(state.A, "hintdot", 4, layers.dots),
    T: board.point(state.A, "hintdot", 4, layers.dots),
  };

  const labelOffsets = {
    A: [-10, -10], B: [-10, -10], P: [8, -8], Q: [8, -8], S: [8, -8],
    O: [-15, 17], R: [-13, -9], T: [8, -8],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 11,
      step: 3,
      layer: layers.handles,
      label: name === "A"
        ? "Point A on the circle. Drag it, or focus it and use the arrow keys"
        : "Point B on the circle. Drag it, or focus it and use the arrow keys",
      describe: (p) => {
        const degrees = Math.round((Math.atan2(p.y - Core.CENTER.y, p.x - Core.CENTER.x) * 180) / Math.PI);
        return `on the circle at ${degrees} degrees.`;
      },
      clamp: (q) => Core.projectToCircle(q) || state[name],
      onMove: (p, which) => apply({ type: "point", name: which, point: p }, `Moved ${which} on the circle.`),
    });
  }

  /** Put short crossbars on a segment: the applet's LineID equality marks. */
  function placeTicks(shapes, p, q, t) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const n = Math.hypot(dx, dy);
    shapes.forEach((shape, i) => {
      if (!Core.finite(p) || !Core.finite(q) || n < 1e-9) { shape.show(false); return; }
      const ux = -dy / n, uy = dx / n;
      const at = t + (i - (shapes.length - 1) / 2) * 0.075;
      const cx = p.x + dx * at, cy = p.y + dy * at;
      const half = 5;
      shape.set(
        { x: cx - ux * half, y: cy - uy * half },
        { x: cx + ux * half, y: cy + uy * half },
      ).show(true);
    });
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    givenCircle.set(Core.CENTER, Core.RADIUS).show(true);
    labels.O.set(Core.CENTER).show(state.showPremise && state.showNames);
    show(dots.O, state.showPremise);

    if (!g || !g.valid || !g.drawable) {
      for (const shape of [...radii, ...rightAngles, ...tangents, chord, crossSegment,
        ...hintLines, ...angleMarks, ...equalTicks, ...halfTicks, ...Object.values(dots)]) show(shape, false);
      for (const name of ["A", "B", "P", "Q", "S", "R", "T"]) labels[name].show(false);
      return;
    }

    const { A, B, P, Q, R, S, T, O, r } = g;
    tangents[0].set(A, P).show(true);
    tangents[1].set(B, Q).show(true);

    radii[0].set(O, A).show(state.showPremise);
    radii[1].set(O, B).show(state.showPremise);
    rightAngles[0].set(A, O, P, 11).show(state.showPremise);
    rightAngles[1].set(B, O, Q, 11).show(state.showPremise);

    chord.set(A, B).show(state.showStatement);
    crossSegment.set(P, Q).show(state.showStatement);
    hintLines[0].set(A, R).show(state.showHint);
    hintLines[1].set(R, Q).show(state.showHint);
    angleMarks[0].set(T, A, B, 20).show(state.showHint);
    angleMarks[1].set(T, R, Q, 27).show(state.showHint);

    placeTicks([equalTicks[0]], A, P, 0.55);
    placeTicks([equalTicks[1]], B, Q, 0.55);
    placeTicks([equalTicks[2]], A, R, 0.55);
    for (const tick of equalTicks.slice(0, 2)) tick.show(state.showPremise);
    equalTicks[2].show(state.showHint);
    placeTicks(halfTicks.slice(0, 2), S, P, 0.5);
    placeTicks(halfTicks.slice(2), S, Q, 0.5);
    for (const tick of halfTicks) tick.show(state.showStatement);

    dots.P.set(P).show(true);
    dots.S.set(S).show(true);
    dots.Q.set(Q).show(true);
    dots.R.set(R).show(state.showHint);
    dots.T.set(T).show(state.showHint);

    const at = { A, B, P, Q, S, R, T };
    for (const name of Object.keys(at)) labels[name].set(at[name]);
    for (const name of ["A", "B", "P", "Q", "S"]) labels[name].show(state.showNames);
    labels.R.show(state.showNames && state.showHint);
    labels.T.show(state.showNames && state.showHint);
  }

  function statusText(current) {
    if (!current.valid) {
      return current.reason === "close"
        ? "A and B are less than two pixels apart, so the applet pauses its drawing."
        : "The tangent is between −2 and 2 pixels long, so the applet pauses its drawing.";
    }
    if (!current.drawable) return "These lines are almost parallel, so their crossing point cannot be drawn.";
    const piece = Core.dist(current.S, current.P).toFixed(1);
    if (state.showHint) {
      return `TA = TB and TR = TQ, so QR ∥ AB; A is the midpoint of PR and PS = QS = ${piece}.`;
    }
    if (state.showStatement) {
      return `AB meets PQ at S: PS = QS = ${piece}, so AB bisects PQ.`;
    }
    if (state.showPremise) {
      return `AP = BQ = ${Math.abs(current.L).toFixed(1)}; each tangent meets its radius at a right angle.`;
    }
    return `AP and BQ are equal tangents. AB meets PQ at its midpoint S (PS = QS = ${piece}).`;
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    const current = Core.compute(state);
    // Compute() in the applet returns early without replacing P, Q, S and T.
    if (current.valid && current.drawable) lastDrawable = current;
    geometry = lastDrawable;
    draw(geometry);
    say((note ? note + " " : "") + statusText(current), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      say("That move is not allowed.");
      return false;
    }
    state = next;
    render(note);
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showStatement: document.getElementById("statementBox"),
    showPremise: document.getElementById("premiseBox"),
    showHint: document.getElementById("hintBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked },
        box.checked ? `Showing ${box.dataset.label}.` : `Hid ${box.dataset.label}.`);
    });
  }

  const slider = document.getElementById("lengthRange");
  const readout = document.getElementById("lengthOut");
  slider.min = String(Core.LENGTH_MIN);
  slider.max = String(Core.LENGTH_MAX);
  slider.value = String(state.length);
  readout.textContent = String(state.length);
  slider.addEventListener("input", () => {
    readout.textContent = slider.value;
    apply({ type: "length", value: Number(slider.value) }, `Tangent length ${slider.value}.`);
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    slider.value = String(Core.LENGTH_DEFAULT);
    readout.textContent = String(Core.LENGTH_DEFAULT);
    for (const key of Object.keys(checkboxes)) checkboxes[key].checked = state[key];
    apply({ type: "reset" }, "Back to the opening picture.");
  });

  // Classes use CSS tokens, so a theme flip needs no new colours; redraw anyway
  // to keep the picture in step with the site's themechange event.
  board.onTheme(() => draw(Core.compute(state)));

  render();
})();
