"use strict";

/*
 * The page for Heron's Formula: drawing and input only; the mathematics is in
 * herons-formula-core.js. The SVG holds the draggable triangle with its
 * incircle and touch points, the six triangles rearranged into a strip at the
 * bottom, and the product diagram on the right, just as in the applet. The
 * "Show names" checkbox is the applet's only option.
 */

(function () {
  const Core = HeronsFormulaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 12, view.x + view.width - 12),
    y: Geom.clamp(p.y, view.y + 12, view.y + view.height - 12),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start();
  let checked = false;
  const initial = Core.configuration(state);

  // Z-order: tinted pieces, then outlines, then dots and text, then handles.
  const fills = board.layer("fills");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const incircle = board.circle(initial.I, initial.r, "incircle", shapes);
  const radii = [0, 1, 2, 3, 4, 5].map(() =>
    board.segment(initial.I, initial.Ia, "radius-line", shapes));
  const touchDots = [0, 1, 2].map(() => board.point(initial.Ia, "touch-dot", 4, marks));

  // The six triangles from the incircle, in the applet's colour groups.
  const wedges = [0, 1, 2, 3, 4, 5].map((i) =>
    board.polygon([state.A, initial.I, initial.Ib], "wedge", fills));

  // The strip at the bottom: three pieces, each a rectangle of height r.
  const stripPieces = [0, 1, 2].map(() =>
    board.polygon([state.A, state.B, state.C, initial.I], "strip", fills));
  const stripEdges = [0, 1, 2, 3, 4, 5].map(() =>
    board.segment(state.A, state.B, "strip-edge", shapes));

  // The product diagram at the right: outer rectangle and its three cuts.
  const rightPieces = [0, 1, 2, 3].map(() =>
    board.polygon([initial.I, initial.Ia, initial.Ib, initial.Ic], "right-piece", fills));
  const rightEdges = [0, 1, 2, 3, 4, 5, 6].map(() =>
    board.segment(initial.I, initial.Ia, "right-edge", shapes));

  const pointLabels = [
    board.label(state.A, "A", "glabel", -18, -12, marks),
    board.label(state.B, "B", "glabel", -18, 22, marks),
    board.label(state.C, "C", "glabel", 8, -10, marks),
    board.label(initial.I, "I", "glabel centre-label", 8, -8, marks),
  ];
  const stripLabels = [
    board.label(state.A, "x", "glabel part-label", -4, 16, marks),
    board.label(state.A, "y", "glabel part-label", -4, 16, marks),
    board.label(state.A, "z", "glabel part-label", -4, 16, marks),
    board.label(state.A, "r", "glabel part-label", -16, -2, marks),
  ];
  const rightLabels = [
    ["x y z", 0.25, -8], ["r y z", 0.75, -8],
    ["r x z", 0.25, 16], ["r r z", 0.75, 16],
    ["r r (x + y)", -0.12, 0.5], ["w r z", 0.5, 0.5],
    ["w y z", 0.25, 0.5], ["r z (x + y)", 0.75, 0.5],
  ].map(([text, u, dy]) => board.label(initial.I, text, "glabel product-label", u, dy, marks));

  /** The line under the picture. "done" marks an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function setPolygon(handle, points) {
    handle.node.setAttribute("points", points.map((p) => `${p.x},${p.y}`).join(" "));
  }

  function render() {
    const g = Core.configuration(state);

    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    const allPieces = [...wedges, ...stripPieces, ...rightPieces];
    const allEdges = [...radii, ...stripEdges, ...rightEdges];
    [...touchDots, ...pointLabels, ...stripLabels, ...rightLabels].forEach((el) => el.show(false));

    if (!g.ok) {
      incircle.show(false);
      allPieces.forEach((p) => p.show(false));
      allEdges.forEach((e) => e.show(false));
      pointLabels.slice(0, 3).forEach((el) => {
        el.show(true);
        el.set([state.A, state.B, state.C][pointLabels.indexOf(el)]);
      });
      say("Move the corners apart to make a triangle.", null);
    } else {
      incircle.show(true);
      incircle.set(g.I, g.r);

      const feet = [g.Ia, g.Ib, g.Ic];
      const wedgeTriangles = [
        [state.A, g.Ic, g.I], [state.A, g.I, g.Ib],
        [state.B, g.Ia, g.I], [state.B, g.I, g.Ic],
        [state.C, g.Ib, g.I], [state.C, g.I, g.Ia],
      ];
      wedges.forEach((w, i) => {
        w.show(true);
        w.node.setAttribute("class", `wedge wedge-${["a", "b", "c"][Math.floor(i / 2)]}`);
        setPolygon(w, wedgeTriangles[i]);
      });
      const radiusEnds = [g.Ia, g.Ib, g.Ic, g.Ia, g.Ib, g.Ic];
      radii.forEach((line, i) => {
        line.show(true);
        line.set(g.I, radiusEnds[i]);
      });
      touchDots.forEach((dot, i) => {
        dot.show(true);
        dot.set(feet[i]);
      });

      const strip = [g.strip.top, g.strip.bottom];
      stripPieces.forEach((piece, i) => {
        piece.show(true);
        piece.node.setAttribute("class", `strip strip-${["a", "b", "c"][i]}`);
        setPolygon(piece, [strip[0][i], strip[1][i], strip[1][i + 1], strip[0][i + 1]]);
      });
      const stripSegments = [
        [g.strip.top[0], g.strip.bottom[3]],
        [g.strip.bottom[0], g.strip.bottom[3]],
        [g.strip.bottom[1], g.strip.top[1]],
        [g.strip.bottom[2], g.strip.top[2]],
        [g.strip.top[0], g.strip.top[3]],
        [g.strip.bottom[0], g.strip.top[0]],
      ];
      stripEdges.forEach((line, i) => {
        line.show(true);
        line.set(stripSegments[i][0], stripSegments[i][1]);
      });

      const R = g.right;
      const rightTriangles = [
        [R.LD, R.LU, R.UM], [R.LD, R.RD, R.RM],
        [R.LD, R.RM, R.UM], [R.UM, R.RU, R.RM],
      ];
      rightPieces.forEach((piece, i) => {
        piece.show(true);
        piece.node.setAttribute("class", `right-piece wedge-${["a", "c", "b", "a"][i]}`);
        setPolygon(piece, rightTriangles[i]);
      });
      const rightSegments = [
        [R.LU, R.LD], [R.LD, R.RD], [R.RD, R.RU], [R.RU, R.LU],
        [R.LD, R.UM], [R.LD, R.RM], [R.RM, R.UM],
      ];
      rightEdges.forEach((line, i) => {
        line.show(true);
        line.set(rightSegments[i][0], rightSegments[i][1]);
      });

      const names = [state.A, state.B, state.C, g.I];
      pointLabels.forEach((label, i) => {
        label.show(state.showNames);
        label.set(names[i]);
      });
      stripLabels[0].set({ x: (g.strip.top[0].x + g.strip.top[1].x) / 2, y: g.strip.top[0].y });
      stripLabels[1].set({ x: (g.strip.top[1].x + g.strip.top[2].x) / 2, y: g.strip.top[0].y });
      stripLabels[2].set({ x: (g.strip.top[2].x + g.strip.top[3].x) / 2, y: g.strip.top[0].y });
      stripLabels[3].set({ x: g.strip.top[0].x - 12, y: (g.strip.top[0].y + g.strip.bottom[0].y) / 2 });
      stripLabels.forEach((label) => label.show(state.showNames));

      const mid = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
      const productPlaces = [
        mid(R.LU, R.UM, 0.5), mid(R.UM, R.RU, 0.5),
        mid(R.LD, R.UM, 0.5), mid(R.RM, R.RD, 0.5),
        mid(R.LU, R.LD, 0.5), mid(R.UM, R.RM, 0.5),
        mid(R.LD, R.UM, 0.25), mid(R.RM, R.RD, 0.25),
      ];
      rightLabels.forEach((label, i) => {
        label.show(state.showNames);
        label.set(productPlaces[i]);
      });

      const statements = [
        `S² = ${fmt(g.area * g.area)}`,
        `sxyz = ${fmt(g.s * g.xyz)}`,
        `S = ${fmt(g.area)} = rs`,
        `x = ${fmt(g.x)}, y = ${fmt(g.y)}, z = ${fmt(g.z)}, s = ${fmt(g.s)}, r = ${fmt(g.r)}`,
      ];
      say(statements.join("; ") + (checked ? ". Both areas match: S = rs and S² = sxyz." : ". Press Check the formula to confirm both areas."),
        checked ? "done" : null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const opts = {
    r: 16, step: 4, shift: 20, layer: handlesLayer, clamp: inside,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  const hA = board.handle("A", state.A, {
    ...opts,
    label: "Corner A. Drag, or focus and use the arrow keys to move it",
    onMove: (p) => moveVertex("A", p),
  });
  const hB = board.handle("B", state.B, {
    ...opts,
    label: "Corner B. Drag, or focus and use the arrow keys to move it",
    onMove: (p) => moveVertex("B", p),
  });
  const hC = board.handle("C", state.C, {
    ...opts,
    label: "Corner C. Drag, or focus and use the arrow keys to move it",
    onMove: (p) => moveVertex("C", p),
  });

  function syncNames() {
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
  }

  function reset() {
    const fresh = Core.start();
    state = { ...fresh, showNames: state.showNames };
    checked = false;
    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);
    syncNames();
    render();
    hA.node.focus();
  }

  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    syncNames();
    render();
  }

  function checkFormula() {
    checked = true;
    render();
    if (!Core.configuration(state).ok) say("Make a triangle first, then check again.", null);
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  checkBtn.addEventListener("click", checkFormula);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "n") toggleNames();
    else if (k === "c") checkFormula();
  });

  board.onTheme(render);
  syncNames();
  render();
})();
