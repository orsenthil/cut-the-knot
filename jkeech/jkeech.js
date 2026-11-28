"use strict";

/*
 * The page for Joseph Keech in Bride's Chair. All the geometry lives in
 * jkeech-core.js; this file only draws it and takes input.
 *
 * The SVG shows the right triangle ABC, the two squares on its legs and the
 * square HCFZ inside it. Drag A or B to rebuild the right triangle, or drag C
 * around the circle it starts on; the three handles also move with the arrow
 * keys. The checkboxes are the applet's own Show names / statement / extra.
 */

(function () {
  const C = JkeechCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const namesBox = document.getElementById("namesBox");
  const statementBox = document.getElementById("statementBox");
  const extraBox = document.getElementById("extraBox");

  let state = C.start({});

  /** An illustration has no winner: the status describes what is on screen. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Painted back to front: fills, the square's circle, outlines, angle arcs,
     point names, and the three draggable corners. */
  const fills = board.layer("fills");
  const rings = board.layer("rings");
  const lines = board.layer("lines");
  const anglesLayer = board.layer("angles");
  const namesLayer = board.layer("names");
  const tops = board.layer("handles");

  const squareAC = board.polygon([state.A, state.C, state.A], "square-fill", fills);
  const squareBC = board.polygon([state.B, state.C, state.B], "square-fill", fills);
  const triangle = board.polygon([state.A, state.B, state.C], "triangle-fill", fills);
  const inner = board.polygon([state.A, state.B, state.C, state.A], "inner-fill", fills);
  const ring = board.circle({ x: 0, y: 0 }, 1, "keech-circle", rings);

  const outlines = Array.from({ length: 9 }, () =>
    board.segment(state.A, state.B, "outline", lines));
  const marks = Array.from({ length: 4 }, () =>
    board.segment(state.A, state.B, "tick", lines));
  const statementLines = [0, 1].map(() =>
    board.segment(state.A, state.B, "statement-line", lines));
  const extraLines = [0, 1, 2].map(() =>
    board.segment(state.A, state.B, "extra-line", lines));
  const arcs = [0, 1, 2, 3].map(() =>
    board.angleArc(state.B, state.C, state.A, 12, "angle-arc", anglesLayer));

  const labelNames = ["A", "B", "C", "D", "E", "K", "L", "F", "H", "Z", "G"];
  const offsets = {
    A: [-16, 19], B: [9, 19], C: [-5, -12], D: [-16, -10], E: [-17, 12],
    K: [8, -10], L: [8, 15], F: [8, -10], H: [-18, -10], Z: [7, 19], G: [-8, 20],
  };
  const labels = {};
  labelNames.forEach((name) => {
    const [dx, dy] = offsets[name];
    labels[name] = board.label(state.A, name, "pt-label", dx, dy, namesLayer);
  });

  const describe = (name, p) =>
    `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`;
  const handles = {};
  ["A", "B", "C"].forEach((name) => {
    handles[name] = board.handle(name, state[name], {
      r: 9, step: 3, shift: 12, cls: "geom-handle", layer: tops,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
      describe: (p) => describe(name, p),
      clamp: (q, which) => (which === "C" && state.glideCircle
        ? C.glide(q, state.glideCircle) : q),
      onMove: (p, which) => {
        state = C.move(state, { type: "vertex", name: which, x: p.x, y: p.y });
        render();
      },
    });
  });

  /* mousePressed in the applet restricts C to the circle it is grabbed on. */
  ["A", "B", "C"].forEach((name) => {
    handles[name].node.addEventListener("pointerdown", () => {
      state = C.grab(state, name);
      render();
    });
  });
  ["pointerup", "pointercancel", "lostpointercapture"].forEach((event) => {
    board.root.addEventListener(event, () => {
      if (state.glideCircle) { state = C.release(state); render(); }
    });
  });

  /** A small cross-bar marking equal sides, as LineID does in the applet. */
  function tick(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const nx = (-dy / len) * 5, ny = (dx / len) * 5;
    return [{ x: mx + nx, y: my + ny }, { x: mx - nx, y: my - ny }];
  }

  function setSegments(shapes, segments, show) {
    segments.forEach(([a, b], i) => {
      if (!a || !b || !C.finite(a) || !C.finite(b)) { shapes[i].show(false); return; }
      shapes[i].set(a, b);
      shapes[i].show(show);
    });
    for (let i = segments.length; i < shapes.length; i++) shapes[i].show(false);
  }

  function render() {
    const g = C.geometry(state);
    const valid = g.active && C.finite(g.L) && C.finite(g.K) &&
      C.finite(g.D) && C.finite(g.E) && C.finite(g.F) &&
      C.finite(g.H) && C.finite(g.Z);

    squareAC.show(valid);
    squareBC.show(valid);
    triangle.show(valid);
    inner.show(valid);
    if (valid) {
      squareAC.set([g.A, g.C, g.D, g.E]);
      squareBC.set([g.B, g.C, g.K, g.L]);
      triangle.set([g.A, g.B, g.C]);
      inner.set([g.C, g.F, g.Z, g.H]);
    }

    if (valid && state.showExtra && g.circle && Number.isFinite(g.circle.r)) {
      ring.set(g.circle.c, g.circle.r);
      ring.show(true);
    } else {
      ring.show(false);
    }

    setSegments(outlines, valid ? [
      [g.A, g.B], [g.B, g.C], [g.C, g.A],
      [g.A, g.E], [g.E, g.D], [g.D, g.C],
      [g.C, g.K], [g.K, g.L], [g.L, g.B],
    ] : [], true);
    setSegments(marks, valid && state.showStatement
      ? [tick(g.C, g.F), tick(g.F, g.Z), tick(g.Z, g.H), tick(g.H, g.C)] : [], true);
    setSegments(statementLines, valid && state.showStatement
      ? [[g.A, g.L], [g.B, g.E]] : [], true);
    setSegments(extraLines, valid && state.showExtra && C.finite(g.G)
      ? [[g.G, g.C], [g.G, g.F], [g.G, g.H]] : [], true);

    const arcData = valid && state.showExtra && C.finite(g.G) ? [
      [g.G, g.F, g.B, 12], [g.G, g.F, g.C, 18],
      [g.G, g.H, g.C, 24], [g.G, g.H, g.A, 30],
    ] : [];
    arcs.forEach((arc, i) => {
      if (!arcData[i]) { arc.show(false); return; }
      const [v, p, q, radius] = arcData[i];
      arc.set(v, p, q, radius);
      arc.show(true);
    });

    const showG = valid && state.showNames && state.showExtra && C.finite(g.G);
    labelNames.forEach((name) => {
      const on = valid && state.showNames &&
        (name !== "G" || showG) &&
        (["A", "B", "C", "D", "E", "K", "L", "F", "H", "Z"].indexOf(name) < 0 ||
          C.finite(g[name.toLowerCase() === "g" ? "G" : name]));
      labels[name].show(!!on);
      if (on) labels[name].set(g[name] || g.A, name);
    });
    ["A", "B", "C"].forEach((name) => handles[name].set(state[name]));

    namesBox.checked = state.showNames;
    statementBox.checked = state.showStatement;
    extraBox.checked = state.showExtra;

    if (!valid) {
      say("This triangle is too flat for the construction; drag a corner to open it out.", null);
    } else {
      const s = g.CF.toFixed(1);
      const angleText = state.showExtra && g.angles
        ? " The four marked angles at G are all 45 degrees."
        : " Tick Show extra to see the circle and the four 45-degree angles.";
      say(`CF = CH = FZ = ZH = ${s}. ${angleText}`,
        C.result(state) === "done" ? "done" : null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function change(key, checked) {
    state = C.move(state, { type: "option", key, value: checked });
    render();
  }
  namesBox.addEventListener("change", () => change("showNames", namesBox.checked));
  statementBox.addEventListener("change", () => change("showStatement", statementBox.checked));
  extraBox.addEventListener("change", () => change("showExtra", extraBox.checked));

  resetBtn.addEventListener("click", () => {
    state = C.start({});
    render();
  });

  board.onTheme(render);
  render();
})();
