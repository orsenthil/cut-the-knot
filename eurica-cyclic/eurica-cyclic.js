"use strict";

/*
 * EuricaCyclic — drawing and input only.  The geometry is in
 * eurica-cyclic-core.js: four corners, the two side intersections P and Q,
 * the four circumcircles and their common point K.  The SVG objects are made
 * once and only updated on a redraw, so a handle keeps keyboard focus.  Every
 * colour comes from a class mapped by index.html to a site custom property.
 */

(function () {
  const Core = EuricaCyclicCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const boxes = {};
  for (const key of Core.OPTION_KEYS) boxes[key] = document.getElementById(key);
  const pickBox = document.getElementById("showPick");

  let state = Core.start();

  /* Layers, back to front. */
  const back = board.layer("circumcircle");
  const sideLayer = board.layer("sides");
  const circleLayer = board.layer("circles");
  const hintLayer = board.layer("hint");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const circum = board.circle(Core.CENTER, Core.RADIUS, "circum", back);
  const quad = board.polygon([state.A, state.B, state.C, state.D], "quad", sideLayer);
  const sides = Array.from({ length: 4 }, () =>
    board.segment(state.A, state.B, "side", sideLayer));
  const miquel = ["miquel miquel-0", "miquel miquel-1", "miquel miquel-2", "miquel miquel-3"].map((cls) =>
    board.circle(state.A, 1, cls, circleLayer));
  const hintLines = Array.from({ length: 3 }, () =>
    board.line(state.A, state.B, "hint-line", hintLayer));
  const hintArcs = Array.from({ length: 4 }, () =>
    board.angleArc(state.A, state.B, state.C, 20, "hint-arc", hintLayer));
  const dots = ["P", "Q", "K"].map((name) =>
    board.point(state.A, "extra-dot", 5, dotLayer));
  const pickDot = board.point(state.A, "pick-dot", 9, dotLayer);

  const labelKeys = ["A", "B", "C", "D", "P", "Q", "K"];
  const labels = {};
  for (const key of labelKeys) labels[key] = board.label(state.A, key, "point-label", 9, -9, labelLayer);

  const handles = {};
  for (const key of Core.CORNERS) {
    handles[key] = board.handle(key, state[key], {
      step: 5, shift: 15, r: 10, layer: handleLayer,
      label: "Corner " + key + ". Drag it, or focus this corner and use the arrow keys.",
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /* Dragging the filled quadrilateral moves all four corners and, as in the
   * applet's MoveablePoly, replaces the grey circle by the one through A,B,C. */
  let shapeDrag = null;
  board.root.addEventListener("pointerdown", (e) => {
    if (e.target !== quad.node) return;
    shapeDrag = board.toLocal(e.clientX, e.clientY);
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!shapeDrag) return;
    const at = board.toLocal(e.clientX, e.clientY);
    state = Core.dragShape(state, Core.sub(at, shapeDrag));
    shapeDrag = at;
    render();
    e.preventDefault();
  });
  const endShapeDrag = () => { shapeDrag = null; };
  board.root.addEventListener("pointerup", endShapeDrag);
  board.root.addEventListener("pointercancel", endShapeDrag);
  board.root.addEventListener("lostpointercapture", endShapeDrag);

  /** #status is how the player's record sees an explored illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function hideConstruction() {
    for (const s of sides.concat(miquel, hintLines, hintArcs, dots)) s.show(false);
    pickDot.show(false);
    for (const key of ["P", "Q", "K"]) labels[key].show(false);
  }

  function render() {
    const g = Core.geometry(state);
    for (const key of Core.CORNERS) handles[key].set(state[key]);
    circum.set({ x: state.circle.x, y: state.circle.y }, state.circle.r);
    quad.set([state.A, state.B, state.C, state.D]);

    if (!g || !g.ok) {
      hideConstruction();
      say(Core.describe(state), Core.result(state));
    } else {
      g.sides.forEach(([p, q], i) => sides[i].set(p, q).show(true));
      ["QKBA", "BKPC", "KCDQ", "AKPD"].forEach((key, i) => {
        const cc = g.circles[key];
        miquel[i].set({ x: cc.x, y: cc.y }, cc.r).show(true);
      });
      g.lines.forEach(([p, q], i) => hintLines[i].set(p, q).show(state.options.hint));
      g.angles.forEach(([v, p, q, size], i) =>
        hintArcs[i].set(v, p, q, size * 14).show(state.options.hint));
      [g.P, g.Q, g.Ktrue].forEach((p, i) => dots[i].set(p).show(true));
      const showPick = pickBox.checked && Core.dist(g.K, g.Ktrue) > 1e-6;
      pickDot.set(g.K).show(showPick);

      for (const key of Core.CORNERS) labels[key].set(g[key], key).show(state.options.names);
      for (const [key, p] of [["P", g.P], ["Q", g.Q], ["K", g.Ktrue]]) {
        labels[key].set(p, key, 9, key === "Q" ? 18 : -9).show(state.options.names);
      }
      say(Core.describe(state), Core.result(state));
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, B: state.B, C: state.C, D: state.D, circle: state.circle,
        P: g && g.P, Q: g && g.Q, K: g && g.Ktrue, appletK: g && g.K,
        circles: g && g.circles, options: state.options,
        claims: g && g.claims,
      });
    }
  }

  for (const key of Core.OPTION_KEYS) {
    boxes[key].checked = state.options[key];
    boxes[key].addEventListener("change", () => {
      state = Core.setOption(state, key, boxes[key].checked);
      render();
    });
  }
  pickBox.addEventListener("change", render);
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render();
  });

  board.onTheme(render);
  render();
})();
