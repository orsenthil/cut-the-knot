"use strict";

/*
 * The page for Cosine Law Unfolded: drawing and input only; the geometry is in
 * cosine-law-unfolded-core.js. Three draggable vertices carry squares on the
 * sides of their triangle. The board redraws the same SVG elements in place,
 * so a handle keeps keyboard focus; the three buttons reproduce the applet's
 * "colors", "names" and "hint" checkboxes, and Reset restores its starting
 * triangle. A demo has no win or loss: the line under the board only reports
 * what is measured in the current picture.
 */

(() => {
  const Core = CosineLawUnfoldedCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));

  const fillLayer = board.layer("fills");
  const edgeLayer = board.layer("edges");
  const hintLayer = board.layer("hints");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = { x: 0, y: 0 };
  const pool = (n, make) => Array.from({ length: n }, make);
  const reds = pool(4, () => board.polygon([], "fill-red", fillLayer));
  const blues = pool(2, () => board.polygon([], "fill-blue", fillLayer));
  const oranges = pool(2, () => board.polygon([], "fill-orange", fillLayer));
  const squareFills = pool(3, () => board.polygon([], "fill-square", fillLayer));
  const squareEdges = pool(3, () => board.polygon([], "square-outline", edgeLayer));
  const lines = pool(13, () => board.segment(origin, origin, "edge", edgeLayer));
  const hints = pool(9, () => board.segment(origin, origin, "hint-edge", hintLayer));
  const hintDots = pool(4, () => board.point(origin, "hint-dot", 4, hintLayer));

  // The applet's ShowNames method labels these fifteen points.
  const nameOffsets = {
    A: [-13, -8], B: [8, -8], C: [-4, -12], T: [-4, -12], R: [8, -4],
    S: [-13, -4], Q: [8, -4], P: [-4, -12], M: [-4, -14], N: [8, -4],
    D: [8, 4], E: [-13, 4], F: [-13, -4], G: [8, -4], H: [8, 4],
  };
  const names = Object.keys(nameOffsets);
  const labels = pool(19, () => board.label(origin, "", "pt-label", 0, -8, labelLayer));

  let state = Core.start();
  const options = { colors: false, names: false, hint: false };

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * the shared record reads those three classes. This is a demo, so no play
   * ever ends in a win or a loss and no kind is ever passed here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function setPolygons(shapes, polys) {
    shapes.forEach((shape, i) => {
      if (i < polys.length) shape.set(polys[i]).show(true);
      else shape.show(false);
    });
  }

  function setSegments(shapes, segments) {
    shapes.forEach((shape, i) => {
      const entry = segments[i];
      if (!entry) { shape.show(false); return; }
      shape.set(entry[0], entry[1]);
      shape.node.setAttribute("class", entry[2]);
      shape.show(true);
    });
  }

  function render() {
    const q = Core.compute(state);
    const m = Core.measure(state);

    const redPolys = options.colors
      ? [[q.P, q.C, q.R], [q.P, q.C, q.T], [q.B, q.D, q.G], [q.A, q.E, q.F]]
      : [];
    const bluePolys = options.colors ? [[q.A, q.B, q.C], [q.E, q.D, q.H]] : [];
    const orangePolys = options.colors ? m.quadrilaterals : [];
    const squarePolys = options.colors
      ? [[q.C, q.A, q.S, q.T], [q.C, q.B, q.Q, q.R], [q.A, q.B, q.D, q.E]]
      : [];
    setPolygons(reds, redPolys);
    setPolygons(blues, bluePolys);
    setPolygons(oranges, orangePolys);
    setPolygons(squareFills, squarePolys);

    setPolygons(squareEdges, [
      [q.C, q.A, q.S, q.T], [q.C, q.B, q.Q, q.R], [q.A, q.B, q.D, q.E],
    ]);

    const unfold = q.SwitchParas
      ? [[q.M, q.F, "edge"], [q.N, q.G, "edge"], [q.H, q.M, "edge"], [q.N, q.H, "edge"]]
      : [[q.M, q.P, "edge"], [q.N, q.P, "edge"], [q.S, q.M, "edge"], [q.N, q.Q, "edge"]];
    setSegments(lines, [
      [q.T, q.P, "edge"], [q.P, q.R, "edge"], [q.C, q.P, "edge key-edge"],
      ...unfold,
      [q.A, q.F, "edge"], [q.E, q.F, "edge"], [q.B, q.G, "edge"],
      [q.D, q.G, "edge"], [q.E, q.H, "edge"], [q.D, q.H, "edge"],
    ]);

    const hintSegments = options.hint
      ? [
        [q.A, q.J, "hint-edge"], [q.B, q.J, "hint-edge"], [q.H, q.J, "hint-edge"],
        [q.J, q.K, "hint-edge"], [q.J, q.L, "hint-edge"],
        ...(q.SwitchParas ? [] : [
          [q.F, q.L, "hint-edge"], [q.H, q.L, "hint-edge"],
          [q.G, q.K, "hint-edge"], [q.H, q.K, "hint-edge"],
        ]),
      ]
      : [];
    setSegments(hints, hintSegments);
    hintDots[0].set(q.O).show(options.hint);
    [q.J, q.K, q.L].forEach((p, i) => {
      hintDots[i + 1].set(p).show(options.hint && options.names);
    });

    labels.forEach((label, i) => {
      if (!options.names || i >= names.length) { label.show(false); return; }
      const key = names[i];
      const off = nameOffsets[key];
      label.set(q[key], key, off[0], off[1]).show(true);
    });
    if (options.names && options.hint) {
      ["O", "J", "K", "L"].forEach((key, i) => {
        labels[names.length + i].set(q[key], key, 7, -7).show(true);
      });
    }

    aHandle.set(q.A);
    bHandle.set(q.B);
    cHandle.set(q.C);

    say(Core.status(state) + (q.SwitchParas
      ? " · unfolded through F and G"
      : " · unfolded through S and Q"));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(p, name) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const description = (p, name) =>
    `${name} is at x ${Math.round(p.x)}, y ${Math.round(p.y)} in board units.`;
  const clampPoint = (p) => ({
    x: Core.clamp(p.x, Core.BOARD.margin, Core.BOARD.width - Core.BOARD.margin),
    y: Core.clamp(p.y, Core.BOARD.margin, Core.BOARD.height - Core.BOARD.margin),
  });
  const aHandle = board.handle("A", state.A, {
    r: 15, step: 4, shift: 4, layer: handleLayer,
    label: "Point A. Drag it, or focus it and use the arrow keys, to move the triangle's corner A.",
    describe: description, clamp: clampPoint, onMove: moveVertex,
  });
  const bHandle = board.handle("B", state.B, {
    r: 15, step: 4, shift: 4, layer: handleLayer,
    label: "Point B. Drag it, or focus it and use the arrow keys, to move the triangle's corner B.",
    describe: description, clamp: clampPoint, onMove: moveVertex,
  });
  const cHandle = board.handle("C", state.C, {
    r: 15, step: 4, shift: 4, layer: handleLayer,
    label: "Point C. Drag it, or focus it and use the arrow keys, to move the triangle's corner C.",
    describe: description, clamp: clampPoint, onMove: moveVertex,
  });

  [["colorsBtn", "colors"], ["namesBtn", "names"], ["hintBtn", "hint"]].forEach(([id, key]) => {
    const btn = document.getElementById(id);
    btn.addEventListener("click", () => {
      options[key] = !options[key];
      btn.setAttribute("aria-pressed", String(options[key]));
      render();
    });
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.start();
    render();
  });

  board.onTheme(render);
  render();
})();
