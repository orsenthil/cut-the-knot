"use strict";

/*
 * The page for Dijkstra: drawing and input only; the geometry lives in
 * dijkstra-core.js. The stage holds the draggable triangle and the two lines
 * from C, plus the stripe through C parallel to AB. The buttons reproduce the
 * applet's four checkboxes (areas, color, hint, names); shape presets stand in
 * for dragging to a particular triangle. This is a demo: no play ever ends in
 * a win or a loss, so the status line only reports what is on the board.
 */

(() => {
  const Core = DijkstraCore;
  const statusEl = document.getElementById("status");
  const board = Geom.board(document.getElementById("board"));

  const fillsLayer = board.layer("fills");
  const edgesLayer = board.layer("edges");
  const hintLayer = board.layer("hints");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const origin = Core.pt(0, 0);
  const pool = (n, make) => Array.from({ length: n }, make);
  const areaFills = pool(3, () => board.polygon([], "area-fill", fillsLayer));
  const triangle = board.polygon([], "triangle-edge", edgesLayer);
  const stripeSides = pool(2, () => board.segment(origin, origin, "stripe-short", edgesLayer));
  const stripeMiddle = board.segment(origin, origin, "stripe-long", edgesLayer);
  const stripeEnds = pool(2, () => board.segment(origin, origin, "stripe-short", edgesLayer));
  const keyLines = pool(2, () => board.segment(origin, origin, "key-line", edgesLayer));
  const attachments = pool(2, () => board.segment(origin, origin, "attach-line", edgesLayer));
  const arcs = [
    board.angleArc(origin, origin, origin, 20, "hint-arc-beta", hintLayer),
    board.angleArc(origin, origin, origin, 20, "hint-arc-beta", hintLayer),
    board.angleArc(origin, origin, origin, 20, "hint-arc-beta", hintLayer),
    board.angleArc(origin, origin, origin, 22, "hint-arc-alpha", hintLayer),
  ];
  const arcLabels = pool(4, () => board.label(origin, "", "hint-label", 0, 0, hintLayer));

  // ShowNames labels these points, with the same coincidence rules.
  const nameOffsets = {
    A: [-15, -8], B: [7, -8], C: [-4, -14], L: [6, 15], N: [6, 15],
    H: [7, 15], D: [7, 15], E: [-15, 15], K: [7, -8], M: [7, -8],
  };
  const names = Object.keys(nameOffsets);
  const labels = pool(names.length, () => board.label(origin, "", "pt-label", 0, 0, labelLayer));

  let state = Core.start();

  /** The line under the game. A demo never passes win, lose or done. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Where to print alpha or beta: halfway between the two rays. */
  function arcLabelPoint(vertex, p, q, radius) {
    const u = Core.sub(p, vertex), v = Core.sub(q, vertex);
    const lu = Math.hypot(u.x, u.y) || 1, lv = Math.hypot(v.x, v.y) || 1;
    const bx = u.x / lu + v.x / lv, by = u.y / lu + v.y / lv;
    const bl = Math.hypot(bx, by) || 1;
    return Core.pt(vertex.x + (bx / bl) * (radius + 12), vertex.y + (by / bl) * (radius + 12));
  }

  function setNamed(label, point, text, key, on) {
    const off = nameOffsets[key];
    label.set(point, text, off[0], off[1]).show(on);
  }

  function syncButtons() {
    for (const key of ["areas", "color", "hint", "names"]) {
      const btn = document.getElementById(key + "Btn");
      btn.setAttribute("aria-pressed", String(state.show[key]));
    }
    const colorBtn = document.getElementById("colorBtn");
    colorBtn.disabled = !state.show.areas;
    colorBtn.setAttribute("aria-disabled", String(!state.show.areas));
  }

  function render() {
    const m = Core.measure(state);
    const q = m.points;
    const shown = state.show;

    triangle.set([q.A, q.B, q.C]).show(true);

    const showAreas = shown.areas && m.valid;
    const polys = showAreas && shown.color
      ? [[q.A, q.B, q.D, q.E], [q.A, q.L, q.K, q.E], [q.B, q.D, q.M, q.N]]
      : [];
    areaFills.forEach((shape, i) => {
      if (i < polys.length) shape.set(polys[i]).show(true);
      else shape.show(false);
    });

    // The three dashed sets trace the stripe through C and its two ends.
    if (showAreas) {
      stripeSides[0].set(q.A, q.E).show(true);
      stripeSides[1].set(q.K, q.L).show(true);
      let ex = Core.extremes(q.C, q.E, q.D);
      ex = Core.extremes(ex[0], ex[1], q.K);
      ex = Core.extremes(ex[0], ex[1], q.M);
      stripeMiddle.set(ex[0], ex[1]).show(true);
      stripeEnds[0].set(q.D, q.B).show(true);
      stripeEnds[1].set(q.M, q.N).show(true);
    } else {
      [...stripeSides, stripeMiddle, ...stripeEnds].forEach((shape) => shape.show(false));
    }

    keyLines[0].set(q.C, q.N).show(m.valid);
    keyLines[1].set(q.C, q.L).show(m.valid);
    // The applet continues the base to A or B when L or N lies outside AB.
    attachments[0].set(q.N, q.A).show(m.valid && !Core.inside(q.N, q.A, q.B));
    attachments[1].set(q.L, q.B).show(m.valid && !Core.inside(q.L, q.B, q.A));

    const hint = [
      [q.A, q.B, q.C], [q.B, q.C, q.A], [q.C, q.A, q.L], [q.C, q.B, q.N],
    ];
    const marks = ["\u03b2", "\u03b2", "\u03b2", "\u03b1"];
    arcs.forEach((arcShape, i) => {
      const on = shown.hint && m.valid;
      arcShape.set(hint[i][0], hint[i][1], hint[i][2], i === 3 ? 22 : 20).show(on);
      arcLabels[i].set(arcLabelPoint(hint[i][0], hint[i][1], hint[i][2], i === 3 ? 22 : 20),
        marks[i]).show(on);
    });

    labels.forEach((label) => label.show(false));
    if (shown.names && m.valid) {
      let i = 0;
      setNamed(labels[i++], q.A, "A", "A", true);
      setNamed(labels[i++], q.B, "B", "B", true);
      setNamed(labels[i++], q.C, "C", "C", true);
      if (Core.dist(q.L, q.N) <= 1) {
        setNamed(labels[i++], q.L, "H", "H", true);
      } else {
        if (Core.dist(q.L, q.B) > 10) setNamed(labels[i++], q.L, "L", "L", true);
        else i++;
        if (Core.dist(q.N, q.A) > 10) setNamed(labels[i++], q.N, "N", "N", true);
        else i++;
      }
      if (showAreas) {
        if (Core.dist(q.C, q.D) > 10) setNamed(labels[i++], q.D, "D", "D", true);
        else i++;
        if (Core.dist(q.C, q.E) > 10) setNamed(labels[i++], q.E, "E", "E", true);
        else i++;
        if (Core.dist(q.K, q.C) > 10 && Core.dist(q.K, q.D) > 10) setNamed(labels[i++], q.K, "K", "K", true);
        else i++;
        if (Core.dist(q.M, q.C) > 10 && Core.dist(q.M, q.E) > 10) setNamed(labels[i++], q.M, "M", "M", true);
      }
    }

    aHandle.set(q.A);
    bHandle.set(q.B);
    cHandle.set(q.C);
    syncButtons();
    say(Core.status(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampPoint = (p) => Core.pt(
    Core.clamp(p.x, Core.BOARD.margin, Core.BOARD.width - Core.BOARD.margin),
    Core.clamp(p.y, Core.BOARD.margin, Core.BOARD.height - Core.BOARD.margin),
  );
  const describe = (p, name) => `${name} is at x ${Math.round(p.x)}, y ${Math.round(p.y)} in board units.`;
  const moveVertex = (p, name) => { state = Core.withPoint(state, name, p); render(); };
  const handleOptions = (name) => ({
    r: 12, step: 4, shift: 4, layer: handleLayer,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys, to move the triangle.`,
    describe, clamp: clampPoint, onMove: moveVertex,
  });
  const aHandle = board.handle("A", state.A, handleOptions("A"));
  const bHandle = board.handle("B", state.B, handleOptions("B"));
  const cHandle = board.handle("C", state.C, handleOptions("C"));

  ["areas", "color", "hint", "names"].forEach((key) => {
    document.getElementById(key + "Btn").addEventListener("click", () => {
      state = Core.toggle(state, key);
      render();
    });
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = Core.start();
    render();
  });
  document.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = { ...Core.preset(btn.dataset.shape), show: state.show };
      render();
    });
  });

  board.onTheme(render);
  render();
})();
