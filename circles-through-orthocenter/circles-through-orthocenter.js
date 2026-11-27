"use strict";

/*
 * The page for Circles Through the Orthocenter: drawing and input only. The
 * geometry lives in circles-through-orthocenter-core.js. An SVG board holds the
 * triangle, the three circles centred at the side midpoints and passing through
 * H, their six crossings with the side lines, and the circle through those six
 * points. A, B and C are draggable Geom handles; the two checkboxes reproduce
 * the applet's "names" and "hint" switches, and Reset brings back the opening
 * triangle. The hint shows the circumcircle of ABC and the radical axes.
 */

(function () {
  const Core = CirclesThroughOrthocenterCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    circles: board.layer("circles"),
    guides: board.layer("guides"),
    points: board.layer("points"),
    dots: board.layer("dots"),
    labels: board.layer("labels"),
    handles: board.layer("handles"),
  };

  let state = Core.start({});
  let geometry = Core.geometry(state);

  /** Status line; "done" is how a demo tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Make every object once and re-set it on each redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const sideKeys = ["a", "b", "c"];
  const radicalKeys = ["ab", "bc", "ca"];
  const midCircles = sideKeys.map((key) =>
    board.circle(state.A, 1, "midcircle circle-" + key, layers.circles));
  const sixCircle = board.circle(state.A, 1, "sixcircle", layers.circles);
  const circumcircle = board.circle(state.A, 1, "circumcircle", layers.circles);

  const triangle = board.polygon([state.A, state.B, state.C], "triangle", layers.guides);
  const altitudes = sideKeys.map(() => board.line(state.A, state.B, "altitude", layers.guides));
  const midlines = sideKeys.map(() => board.segment(state.A, state.B, "midline", layers.guides));

  const crossDots = Array.from({ length: 6 }, (_, i) =>
    board.point(state.A, "crossdot crossdot-" + sideKeys[Math.floor(i / 2)], 4, layers.dots));
  const Hdot = board.point(state.A, "orthodot", 4.5, layers.dots);
  const Odot = board.point(state.A, "centerdot", 3.5, layers.dots);
  const midDots = sideKeys.map((key) =>
    board.point(state.A, "middot middot-" + key, 3, layers.dots));
  const radicalDots = sideKeys.map(() =>
    board.point(state.A, "radicaldot", 4, layers.dots));

  const labelOffsets = {
    A: [-9, -10], B: [7, -9], C: [7, 15], H: [-8, -10], O: [9, -8],
    Ma: [-16, 16], Mb: [9, -9], Mc: [-19, -9],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handles = {};
  for (const name of Core.NAMES) {
    handles[name] = board.handle(name, state[name], {
      r: 10,
      step: 3,
      cls: "geom-handle corner-handle",
      layer: layers.handles,
      label: "Corner " + name + ". Drag it, or focus it and use the arrow keys to move the triangle",
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q, which) => {
        const inside = Core.clampPoint(q);
        return Core.NAMES.some((other) => other !== which && Core.dist(inside, state[other]) < Core.MIN_GAP)
          ? state[which] : inside;
      },
      onMove: (p, which) => apply({ type: "point", name: which, point: p },
        "Moved corner " + which + "."),
    });
  }

  function show(shape, on) { shape.show(!!on); return shape; }
  function showLabel(name, on) { return show(labels[name], on && state.showNames); }

  function draw() {
    geometry = Core.geometry(state);
    triangle.set([state.A, state.B, state.C]);
    for (const name of Core.NAMES) handles[name].set(state[name]);

    if (geometry.degenerate) {
      for (const s of [...midCircles, sixCircle, circumcircle, ...altitudes,
        ...midlines, ...crossDots, Hdot, Odot, ...midDots, ...radicalDots]) show(s, false);
      for (const name of Object.keys(labels)) showLabel(name, false);
      return;
    }

    const { H, O, mids, circles, six, theoremCircle, circumcircle: circum, radical } = geometry;
    sideKeys.forEach((key, i) => {
      midCircles[i].set(circles[key].c, circles[key].r).show(true);
      midDots[i].set(mids[key]).show(true);
    });
    sixCircle.set(theoremCircle.c, theoremCircle.r).show(true);
    show(circumcircle, state.showHint);
    if (state.showHint) circumcircle.set(circum.c, circum.r);

    const vertex = { a: state.A, b: state.B, c: state.C };
    const opposite = { a: [state.B, state.C], b: [state.C, state.A], c: [state.A, state.B] };
    sideKeys.forEach((key, i) => {
      altitudes[i].set(vertex[key], geometry.feet[key]).show(true);
      const other = sideKeys[(i + 1) % 3];
      midlines[i].set(mids[key], mids[other]).show(state.showHint);
      const rad = radical[radicalKeys[i]];
      show(radicalDots[i], state.showHint && !!rad);
      if (rad) radicalDots[i].set(rad);
    });

    six.forEach((p, i) => crossDots[i].set(p).show(true));
    Hdot.set(H).show(true);
    Odot.set(O).show(true);

    const at = {
      A: state.A, B: state.B, C: state.C, H, O,
      Ma: mids.a, Mb: mids.b, Mc: mids.c,
    };
    for (const name of Object.keys(labels)) {
      showLabel(name, true);
      if (labels[name].node.style.display !== "none") labels[name].set(at[name]);
    }
    // The proved circle is drawn in every case, including a right triangle,
    // where the applet's own three chosen crossings coincide.
  }

  function statusText() {
    if (geometry.degenerate) {
      return "Put the three corners apart so they make a triangle.";
    }
    const r = Core.residuals(state, geometry);
    const gap = r ? r.concyclic : Math.max(...geometry.six.map(
      (p) => Math.abs(Core.dist(geometry.O, p) - geometry.theoremCircle.r)));
    if (!geometry.circle) {
      return "Here H is a corner: the six crossings are the three corners twice over, all on the circumcircle.";
    }
    if (gap < 1e-4) {
      return "All six crossings sit on one circle around O. The largest gap is " + gap.toFixed(3) + " board units.";
    }
    return "Move a corner to see the six crossings follow the triangle.";
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
    // Keep the theorem measurement on screen after the move, not just the note.
    if (note) say(note + " " + statusText(), Core.result(state));
    return true;
  }

  const checkboxes = {
    showNames: document.getElementById("namesBox"),
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
    apply({ type: "reset" }, "Back to the opening triangle and circles.");
  });

  // Classes use CSS tokens, so a theme flip only needs a redraw of the SVG.
  board.onTheme(() => draw());

  render();
})();
