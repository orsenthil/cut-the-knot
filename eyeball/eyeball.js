"use strict";

/*
 * The page for Eyeball: drawing and input only. The geometry is in
 * eyeball-core.js. The SVG board holds the two circles (each with a centre and
 * a radius handle), the four tangent rays, the chords PQ and RS cut on the
 * circles, and, on request, the rectangle sides and the three helper circles.
 * The four points are Geom handles, so a pointer or the arrow keys can move
 * either circle; the two checkboxes mirror the applet's panel.
 */

(function () {
  const Core = EyeballCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    extras: board.layer("extras"),
    tangents: board.layer("tangents"),
    chords: board.layer("chords"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start();

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Build every SVG object once and re-set it on each redraw, so a handle
     keeps its keyboard focus while the rest of the picture changes. */
  const circleA = board.circle(state.A, 1, "eyeball-circle circle-a", layers.circles);
  const circleB = board.circle(state.B, 1, "eyeball-circle circle-b", layers.circles);
  const diameter = board.circle(state.A, 1, "helper-circle diameter", layers.extras);
  const helperCircles = [
    board.circle(state.A, 1, "helper-circle helper", layers.extras),
    board.circle(state.A, 1, "helper-circle helper", layers.extras),
  ];
  const tangents = [
    board.segment(state.A, state.B, "tangent tangent-a", layers.tangents),
    board.segment(state.A, state.B, "tangent tangent-a", layers.tangents),
    board.segment(state.A, state.B, "tangent tangent-b", layers.tangents),
    board.segment(state.A, state.B, "tangent tangent-b", layers.tangents),
  ];
  const chords = [
    board.segment(state.A, state.B, "eyeball-chord chord-pq", layers.chords),
    board.segment(state.A, state.B, "eyeball-chord chord-rs", layers.chords),
  ];
  const rectangleSides = [
    board.segment(state.A, state.B, "rect-side", layers.chords),
    board.segment(state.A, state.B, "rect-side", layers.chords),
  ];
  const touchDots = [
    board.point(state.A, "touch-dot", 4, layers.dots),
    board.point(state.A, "touch-dot", 4, layers.dots),
    board.point(state.A, "touch-dot", 4, layers.dots),
    board.point(state.A, "touch-dot", 4, layers.dots),
  ];
  const labelOffsets = { A: [-18, -12], B: [12, -12], P: [-18, 20], Q: [-18, -12], R: [10, 20], S: [10, -12] };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handleNotes = {
    A: "Centre A moved.",
    RA: "Circle A resized.",
    B: "Centre B moved.",
    RB: "Circle B resized.",
  };
  const clampToBoard = (q) => ({
    x: Math.max(8, Math.min(Core.WIDTH - 8, q.x)),
    y: Math.max(8, Math.min(Core.HEIGHT - 8, q.y)),
  });
  const descriptions = {
    A: "Circle A centre.",
    RA: "Circle A radius point.",
    B: "Circle B centre.",
    RB: "Circle B radius point.",
  };
  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 15,
      step: 8,
      layer: layers.handles,
      label: descriptions[name] + " Drag it, or focus it and use the arrow keys to move it.",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q) => {
        const p = clampToBoard(q);
        if (name === "A" || name === "B") return p;
        const centre = name === "RA" ? state.A : state.B;
        const other = name === "RA" ? state.RA : state.RB;
        const d0 = Core.dist(centre, other);
        if (Core.dist(centre, p) >= Core.MIN_RADIUS) return p;
        const away = d0 > 1e-9 ? Core.mul(Core.sub(other, centre), 1 / d0) : { x: 0, y: -1 };
        return clampToBoard(Core.add(centre, Core.mul(away, Core.MIN_RADIUS)));
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p }, handleNotes[which]),
    });
  }

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    circleA.set(g.A, g.rA).show(true);
    circleB.set(g.B, g.rB).show(true);
    labels.A.set(g.A).show(true);
    labels.B.set(g.B).show(true);

    if (!g.valid) {
      for (const shape of [...tangents, ...chords, ...rectangleSides, ...touchDots,
        diameter, ...helperCircles]) show(shape, false);
      for (const name of ["P", "Q", "R", "S"]) labels[name].show(false);
      return;
    }

    // DrawTangents(C1,C2) puts its rays on circle A and its chord on circle B.
    const raysA = [g.fromB.touch[0], g.fromB.touch[1]]; // rays from B to circle A
    const raysB = [g.fromA.touch[0], g.fromA.touch[1]]; // rays from A to circle B
    for (let i = 0; i < 2; i++) {
      tangents[i].set(g.B, raysA[i]).show(true);
      tangents[i + 2].set(g.A, raysB[i]).show(true);
    }
    chords[0].set(g.PQ[0], g.PQ[1]).show(true);
    chords[1].set(g.RS[0], g.RS[1]).show(true);
    rectangleSides[0].set(g.PQ[0], g.RS[0]).show(state.showRectangle);
    rectangleSides[1].set(g.RS[1], g.PQ[1]).show(state.showRectangle);
    diameter.set(g.diameter.centre, g.diameter.radius).show(state.showExtra);
    for (let i = 0; i < 2; i++) {
      const c = g.extra[i];
      helperCircles[i].show(!!c && state.showExtra);
      if (c) helperCircles[i].set(c.centre, c.radius);
    }
    for (let i = 0; i < 2; i++) {
      touchDots[i].set(raysA[i]).show(true);
      touchDots[i + 2].set(raysB[i]).show(true);
    }
    const at = { P: g.PQ[0], Q: g.PQ[1], R: g.RS[0], S: g.RS[1] };
    for (const name of Object.keys(at)) labels[name].set(at[name]).show(true);
  }

  function statusText(g) {
    if (!g.valid) return "The circles are too close for both tangents. Drag a centre or a radius point to try again.";
    const len = (v) => v.toFixed(2);
    let text = "PQ = " + len(g.pq) + " and RS = " + len(g.rs)
      + ". Both are 2·rA·rB/AB = " + len(g.formula) + ".";
    if (state.showRectangle) text += " PQSR is a rectangle.";
    if (state.showExtra) text += " The orange circles pass through the touch points.";
    return text;
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    const g = Core.compute(state);
    draw(g);
    say((note ? note + " " : "") + statusText(g), Core.result(state));
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
    showExtra: document.getElementById("extraBox"),
    showRectangle: document.getElementById("rectangleBox"),
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
    apply({ type: "reset" }, "Back to the opening circles.");
  });

  // Classes use CSS tokens, so a theme flip needs no new colours; redraw anyway.
  board.onTheme(() => draw(Core.compute(state)));

  render();
})();
