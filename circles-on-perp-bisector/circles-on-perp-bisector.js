"use strict";

/*
 * The page for Circles On Perp Bisector: drawing and input only. The geometry
 * is in circles-on-perp-bisector-core.js. An SVG board holds the triangle, the
 * perpendicular bisector of BC, the coaxal circle (O) through B and C and the
 * two circles tangent to AB and AC. A, B, C and O are draggable Geom handles;
 * O is kept on the perpendicular bisector. The three checkboxes reproduce the
 * applet's "names", "common tangents" and "line of tangencies" switches.
 */

(function () {
  const Core = CirclesOnPerpBisectorCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board("board");

  const layers = {
    guides: board.layer("guides"),
    circles: board.layer("circles"),
    tangents: board.layer("tangents"),
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

  /* Objects are made once and re-set on every redraw, so a handle keeps its
     keyboard focus while the rest of the picture changes. */
  const pbis = board.line(state.O, state.O, "perp-bisector", layers.guides);
  const sideAB = board.line(state.A, state.B, "side", layers.guides);
  const sideAC = board.line(state.A, state.C, "side", layers.guides);
  const sideBC = board.segment(state.B, state.C, "side-bc", layers.guides);
  const circleO = board.circle(state.O, 1, "circle-o", layers.circles);
  const circleI = board.circle(state.O, 1, "circle-i", layers.circles);
  const circleP = board.circle(state.O, 1, "circle-p", layers.circles);
  const stLine = board.line(state.O, state.O, "st-line", layers.tangents);
  const tangentLines = [
    board.line(state.O, state.O, "tangent", layers.tangents),
    board.line(state.O, state.O, "tangent", layers.tangents),
  ];
  const touchS = board.point(state.O, "touchdot", 4, layers.dots);
  const touchT = board.point(state.O, "touchdot", 4, layers.dots);
  const centreM = board.point(state.O, "middot", 3.5, layers.dots);

  const labelOffsets = {
    A: [-8, -10], B: [-14, 17], C: [8, 17], O: [8, 16], M: [-12, 17],
    I: [-8, -9], P: [8, -9], S: [8, -8], T: [8, -8],
  };
  const labels = {};
  for (const name of Object.keys(labelOffsets)) {
    labels[name] = board.label(state.A, name, "geom-label point-label",
      labelOffsets[name][0], labelOffsets[name][1], layers.labels);
  }

  const handleLabels = {
    A: "Point A. Drag it, or focus it and use the arrow keys to move the triangle.",
    B: "Point B. Drag it, or focus it and use the arrow keys to move the triangle.",
    C: "Point C. Drag it, or focus it and use the arrow keys to move the triangle.",
    O: "Circle centre O. Drag it along the perpendicular bisector of BC, or focus it and press the arrow keys.",
  };
  const clampPoint = (q) => ({
    x: Core.clamp(q.x, 4, Core.W - 4),
    y: Core.clamp(q.y, 4, Core.H - 4),
  });
  const handles = {};
  for (const name of Core.HANDLES) {
    handles[name] = board.handle(name, state[name], {
      r: 9,
      step: 3,
      layer: layers.handles,
      label: handleLabels[name],
      describe: (p) => "at board position " + Math.round(p.x) + ", " + Math.round(p.y) + ".",
      clamp: (q) => (name === "O" ? Core.onBisector(state, q) : clampPoint(q)),
      onMove: (p) => apply({ name, x: p.x, y: p.y }, "You moved point " + name + "."),
    });
  }

  // Geom's arrow-key handler steps in screen x/y. O can only move along the
  // perpendicular bisector, so interpret any arrow as a step along that line.
  handles.O.node.addEventListener("keydown", (ev) => {
    const delta = {
      ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
    }[ev.key];
    if (!delta) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const M = Core.midpoint(state.B, state.C);
    const dir = Core.unit(Core.sub(Core.perpPoint(M, state.B, state.C), M));
    const along = delta.x * dir.x + delta.y * dir.y;
    const sign = Math.abs(along) > 1e-9 ? Math.sign(along)
      : (delta.x !== 0 ? Math.sign(delta.x) : Math.sign(delta.y));
    const step = (ev.shiftKey ? 15 : 3) * (sign || 1);
    apply(Core.slideO(state, step), "You slid O along the perpendicular bisector.");
    ev.currentTarget.focus();
  }, true);

  function show(shape, on) { shape.show(on); return shape; }

  function draw(g) {
    for (const name of Core.HANDLES) handles[name].set(state[name]);
    sideAB.set(g.A, g.B).show(true);
    sideAC.set(g.A, g.C).show(true);
    sideBC.set(g.B, g.C).show(true);
    const M = Core.midpoint(g.B, g.C);
    pbis.set(M, Core.perpPoint(M, g.B, g.C)).show(true);

    const ready = g.valid;
    show(circleO, ready);
    show(circleI, ready);
    show(circleP, ready);
    show(touchS, ready);
    show(touchT, ready);
    show(centreM, true);
    centreM.set(M);
    show(labels.A, state.showNames);
    show(labels.B, state.showNames);
    show(labels.C, state.showNames);
    show(labels.O, state.showNames);
    show(labels.M, state.showNames && ready);

    if (!ready) {
      for (const line of tangentLines) show(line, false);
      for (const name of ["I", "P", "S", "T"]) show(labels[name], false);
      return;
    }

    circleO.set(g.O, g.circle.r);
    circleI.set(g.I, g.I.r);
    circleP.set(g.P, g.P.r);
    touchS.set(g.S);
    touchT.set(g.T);
    stLine.set(g.S, g.T).show(state.showHint);
    tangentLines.forEach((line, i) => {
      const t = g.tangents[i];
      show(line, !!t && state.showTangents);
      if (t) line.set(t.a, t.b);
    });

    const at = { A: g.A, B: g.B, C: g.C, O: g.O, M, I: g.I, P: g.P, S: g.S, T: g.T };
    for (const name of ["I", "P", "S", "T"]) {
      show(labels[name], state.showNames && !!(name === "I" ? g.I : name === "P" ? g.P
        : name === "S" ? g.S : g.T));
      if (labels[name].node.style.display !== "none") labels[name].set(at[name]);
    }
    for (const name of ["A", "B", "C", "O", "M"]) labels[name].set(at[name]);
    if (state.showNames) labels.I.node.textContent = "I"; // (I) is the inner circle
  }

  function degrees(dir) {
    return (Math.atan2(dir.y, dir.x) * 180 / Math.PI).toFixed(1);
  }

  function statusText(g) {
    if (!g.valid) {
      return "This triangle has no angle to bisect. Move A, B or C until the three points make a triangle.";
    }
    const bc = Core.sub(g.C, g.B);
    if (g.tangents.length === 2) {
      const slopes = g.tangents.map((line) => Core.parallelCross(line, bc));
      const near = Math.min(...slopes);
      if (near < 1e-6) {
        const inc = Core.incircle(g.A, g.B, g.C);
        const isIncircle = Core.dist(g.I, inc) < 2 && Math.abs(g.I.r - inc.r) < 2;
        return "One common internal tangent is parallel to BC, at " + degrees(bc)
          + "°, and the other is antiparallel at " + degrees(g.tangents.find(
            (line) => Core.parallelCross(line, bc) >= 1e-6).dir)
          + "°. " + (isIncircle
            ? "I is very close to the incircle: this is Unger's theorem's configuration."
            : "I is not the incircle here, so this is the applet's broader illustration.");
      }
      return "The common internal tangents run at " + g.tangents.map((line) => degrees(line.dir))
        .join("° and ") + "°; BC runs at " + degrees(bc)
        + "° — neither is parallel. (I) has radius " + g.I.r.toFixed(1)
        + " and (P) has radius " + g.P.r.toFixed(1) + ".";
    }
    return "The two auxiliary circles overlap, so they have no common internal tangent. Move O or a vertex to separate them.";
  }

  /** Redraw, speak the result and save the position for the player's record. */
  function render(note) {
    geometry = Core.geometry(state);
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
    showTangents: document.getElementById("tangentsBox"),
    showHint: document.getElementById("stBox"),
  };
  for (const key of Object.keys(checkboxes)) {
    const box = checkboxes[key];
    box.checked = state[key];
    box.addEventListener("change", () => {
      state = Core.setOptions(state, { [key]: box.checked });
      render(box.checked ? "You switched " + box.dataset.label + " on."
        : "You hid " + box.dataset.label + ".");
    });
  }
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.reset(state);
    render("The four points are back where they started.");
  });

  // The classes use CSS tokens, so a theme flip needs no new colours; redraw
  // anyway to keep the picture in step with the site's themechange event.
  board.onTheme(() => draw(Core.geometry(state)));

  render();
})();
