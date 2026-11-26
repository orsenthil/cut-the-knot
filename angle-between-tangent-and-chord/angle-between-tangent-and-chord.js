"use strict";

/*
 * The page for Angle Between Tangent And Chord: drawing and input only. The
 * geometry is in angle-between-tangent-and-chord-core.js. An SVG board holds the
 * given circle, the two tangents from C and the triangle they make; O, R and C
 * are draggable Geom handles, so a pointer or the arrow keys can put the circle
 * and the outside point anywhere. The three checkboxes reproduce the applet's
 * "names", "statement" and "hint" switches.
 */

(function () {
  const Core = AngleBetweenTangentAndChordCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circle: board.layer("circle"),
    tangents: board.layer("tangents"),
    statement: board.layer("statement"),
    hint: board.layer("hint"),
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

  /* Objects are made once and re-set on every redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const givenCircle = board.circle(state.O, geometry.r, "given-circle", layers.circle);
  const tangentA = board.segment(geometry.A, geometry.C, "tangent", layers.tangents);
  const tangentB = board.segment(geometry.B, geometry.C, "tangent", layers.tangents);
  const chord = board.segment(geometry.A, geometry.B, "chord", layers.statement);
  const insideCircle = board.circle(geometry.I, 1, "inside-circle", layers.statement);
  const bisectors = [
    board.segment(geometry.A, geometry.I, "bisector", layers.hint),
    board.segment(geometry.B, geometry.I, "bisector", layers.hint),
  ];
  const angleMarks = [
    board.angleArc(geometry.A, geometry.C, geometry.I, 18, "anglemark", layers.hint),
    board.angleArc(geometry.A, geometry.I, geometry.B, 23, "anglemark", layers.hint),
    board.angleArc(geometry.B, geometry.I, geometry.C, 18, "anglemark", layers.hint),
    board.angleArc(geometry.B, geometry.A, geometry.I, 23, "anglemark", layers.hint),
  ];
  const touchDots = [
    board.point(geometry.A, "touchdot", 4, layers.dots),
    board.point(geometry.B, "touchdot", 4, layers.dots),
  ];
  const incenterDot = board.point(geometry.I, "incenterdot", 4.5, layers.dots);

  const labelOffsets = {
    A: [-7, -10], B: [-7, -10], C: [8, -8], I: [8, -8], O: [-13, 16], R: [-15, -8],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.O, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handleNotes = {
    O: "Circle centre moved.",
    R: "Circle resized.",
    C: "Point C moved.",
  };
  const clampToBoard = (q) => ({
    x: Math.max(8, Math.min(Core.WIDTH - 8, q.x)),
    y: Math.max(8, Math.min(Core.HEIGHT - 8, q.y)),
  });
  const handles = {};
  for (const name of Core.HANDLES) {
    const labelsBy = {
      O: "Circle centre O. Drag it, or focus it and use the arrow keys to move the circle.",
      R: "Radius point R. Drag it, or focus it and use the arrow keys to change the circle's size.",
      C: "Outside point C. Drag it, or focus it and use the arrow keys to move the tangents.",
    };
    handles[name] = board.handle(name, state[name], {
      r: 10,
      step: 3,
      layer: layers.handles,
      label: labelsBy[name],
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q) => {
        const p = clampToBoard(q);
        if (name !== "R" || Core.dist(p, state.O) >= Core.MIN_RADIUS) return p;
        // Keep a usable circle: push R out along the direction it already has.
        const d0 = Core.dist(state.O, state.R);
        const away = d0 > 1e-9 ? Core.mul(Core.sub(state.R, state.O), 1 / d0) : { x: -1, y: 0 };
        return clampToBoard(Core.add(state.O, Core.mul(away, Core.MIN_RADIUS)));
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p }, handleNotes[which]),
    });
  }

  function statusText(g) {
    if (!g.valid) return "Move C outside the circle so the two tangents can be drawn.";
    const degrees = (g.halfArc * 180 / Math.PI).toFixed(1);
    if (state.showHint) {
      return "All four marked angles are " + degrees + "°: a tangent-chord angle equals the inscribed angle on the same arc. I is on the circle.";
    }
    if (state.showStatement) {
      return "I is the incenter of triangle ABC and sits on the circle at I′, halfway along the small arc AB.";
    }
    return "Tangents from C touch the circle at A and B. Drag O, R or C; tick Show hint to see the four equal angles.";
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    givenCircle.set(g.O, g.r).show(true);
    labels.O.set(g.O).show(true);
    labels.R.set(state.R).show(true);

    if (!g.valid) {
      for (const shape of [tangentA, tangentB, chord, insideCircle, incenterDot,
        ...bisectors, ...angleMarks, ...touchDots]) show(shape, false);
      for (const name of ["A", "B", "C", "I"]) labels[name].show(false);
      return;
    }

    tangentA.set(g.A, g.C).show(true);
    tangentB.set(g.B, g.C).show(true);
    chord.set(g.A, g.B).show(state.showStatement);
    // The applet's GetIncircle draws a circle of radius 2/3 of the true
    // inradius; keep that quirk, as the logic test records.
    insideCircle.set(g.I, g.shownInradius).show(state.showStatement);
    bisectors[0].set(g.A, g.I).show(state.showHint);
    bisectors[1].set(g.B, g.I).show(state.showHint);
    angleMarks[0].set(g.A, g.C, g.I, 18).show(state.showHint);
    angleMarks[1].set(g.A, g.I, g.B, 23).show(state.showHint);
    angleMarks[2].set(g.B, g.I, g.C, 18).show(state.showHint);
    angleMarks[3].set(g.B, g.A, g.I, 23).show(state.showHint);
    touchDots[0].set(g.A).show(true);
    touchDots[1].set(g.B).show(true);
    incenterDot.set(g.I).show(state.showStatement || state.showHint);

    const at = { A: g.A, B: g.B, C: g.C, I: g.I };
    for (const name of Object.keys(at)) labels[name].set(at[name]);
    labels.I.node.textContent = state.showHint && !state.showStatement ? "I′" : "I";
    labels.A.show(state.showNames);
    labels.B.show(state.showNames);
    labels.C.show(state.showNames);
    labels.I.show(state.showNames && (state.showStatement || state.showHint));
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    geometry = Core.compute(state);
    draw(geometry);
    say((note ? note + " " : "") + statusText(geometry), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /** Apply one core move; an illegal one leaves the picture as it was. */
  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) {
      say("That spot is not allowed.");
      return false;
    }
    state = next;
    render(note);
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
    showStatement: document.getElementById("statementBox"),
    showHint: document.getElementById("hintBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      apply({ type: "option", key, value: box.checked },
        box.checked ? "Showing " + box.dataset.label + "." : "Hid " + box.dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    apply({ type: "reset" }, "Back to the opening circle.");
  });

  // Classes use CSS tokens, so a theme flip needs no new colours; redraw anyway
  // to keep the picture in step with the site's themechange event.
  board.onTheme(() => draw(Core.compute(state)));

  render();
})();
