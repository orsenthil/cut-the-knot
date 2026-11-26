"use strict";

/*
 * The page for Angles In Circle: drawing and input only. The rules are in
 * angles-in-circle-core.js. The board holds a circle, two clipped secants through
 * a draggable intersection A, the intercepted arcs on the circle, and three
 * handles: A and one point on each secant. A demo has nothing to win.
 */

(function () {
  const Core = AnglesInCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const arcsBox = document.getElementById("arcsBox");
  const anglesBox = document.getElementById("anglesBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({});

  /**
   * Shows the line under the picture. `kind` is "win", "lose", "done" or
   * nothing; those three classes tell the player's record that a play ended.
   * This illustration never ends, so no kind is ever passed.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: circle, secants, arcs, marks, labels, handles. */
  const guides = board.layer("guides");
  const chords = board.layer("chords");
  const arcs = board.layer("arcs");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const tops = board.layer("tops");

  const circle = board.circle(state.center, state.radius, "sec-circle", guides);
  const centerDot = board.point(state.center, "center-dot", 3, guides);
  const chordOne = board.line(state.A, state.C, "secant-one", chords);
  const chordTwo = board.line(state.A, state.B, "secant-two", chords);
  const arcBC = board.el("path", null, "arc-bc", arcs);
  const arcDE = board.el("path", null, "arc-de", arcs);
  const angleMark = board.angleArc(state.A, state.B, state.C, 19, "angle-mark", marks);
  const ptB = board.point(state.center, "cut-near", 3.4, marks);
  const ptC = board.point(state.center, "cut-near", 3.4, marks);
  const ptD = board.point(state.center, "cut-far", 3.4, marks);
  const ptE = board.point(state.center, "cut-far", 3.4, marks);
  const nameA = board.label(state.A, "A", "pt-label", 8, -9, labels);
  const nameB = board.label(state.center, "B", "pt-label", 7, -7, labels);
  const nameC = board.label(state.center, "C", "pt-label", 7, -7, labels);
  const nameD = board.label(state.center, "D", "pt-label", 7, -7, labels);
  const nameE = board.label(state.center, "E", "pt-label", 7, -7, labels);

  /* The label offsets come from the label's own place on the circle. */
  const where = (p) => ({ dx: p.x < state.center.x ? -16 : 7, dy: p.y < state.center.y ? -6 : 14 });

  const aHandle = board.handle("A", state.A, {
    r: 9, step: 3, cls: "geom-handle sec-handle", layer: tops,
    label: "Point A, where the two secants meet. Drag it, or focus it and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.moveA(state, p); render(); },
  });
  const bHandle = board.handle("B", state.B, {
    r: 8, step: 3, cls: "geom-handle sec-handle", layer: tops,
    label: "Point on the second secant, towards B. Drag it, or focus it and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.moveHandle(state, "B", p); render(); },
  });
  const cHandle = board.handle("C", state.C, {
    r: 8, step: 3, cls: "geom-handle sec-handle", layer: tops,
    label: "Point on the first secant, towards C. Drag it, or focus it and use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p) => { state = Core.moveHandle(state, "C", p); render(); },
  });

  /* Draw exactly the arc that arcBetween measured: increasing SVG angle,
     with the large-arc flag set when the intercepted arc is a major arc. */
  function setArc(node, from, size) {
    const c = state.center, r = state.radius;
    const a0 = Math.atan2(from.y - c.y, from.x - c.x);
    const a1 = a0 + size;
    const p0 = { x: c.x + r * Math.cos(a0), y: c.y + r * Math.sin(a0) };
    const p1 = { x: c.x + r * Math.cos(a1), y: c.y + r * Math.sin(a1) };
    const large = size > Math.PI ? 1 : 0;
    node.setAttribute("d", `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} ` +
      `A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`);
  }

  function render() {
    const g = Core.compute(state);
    circle.set(state.center, state.radius);
    centerDot.set(state.center, 3);
    chordOne.set(state.A, state.C);
    chordTwo.set(state.A, state.B);
    aHandle.set(state.A);
    bHandle.set(state.B);
    cHandle.set(state.C);

    const ok = g.available && g.B && g.C && g.D && g.E;
    arcBC.style.display = ok && state.showArcs && g.arcBC > 1e-5 ? "" : "none";
    arcDE.style.display = ok && state.showArcs && g.arcDE > 1e-5 ? "" : "none";
    angleMark.show(ok && state.showAngles);
    if (ok) {
      setArc(arcBC, g.B, g.arcBC);
      setArc(arcDE, g.D, g.arcDE);
      angleMark.set(state.A, g.B, g.C, 19);
      ptB.set(g.B, 3.4); ptC.set(g.C, 3.4);
      ptD.set(g.D, 3.4); ptE.set(g.E, 3.4);
      const oB = where(g.B), oC = where(g.C), oD = where(g.D), oE = where(g.E);
      nameA.set(state.A, "A", 8, -9);
      nameB.set(g.B, "B", oB.dx, oB.dy);
      nameC.set(g.C, "C", oC.dx, oC.dy);
      nameD.set(g.D, "D", oD.dx, oD.dy);
      nameE.set(g.E, "E", oE.dx, oE.dy);
    }
    [ptB, ptC, ptD, ptE, nameB, nameC, nameD, nameE].forEach((shape) => shape.show(ok && state.showNames));
    nameA.show(state.showNames);

    namesBox.checked = state.showNames;
    arcsBox.checked = state.showArcs;
    anglesBox.checked = state.showAngles;
    say(Core.describe(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function reset() {
    state = Core.start({
      showNames: state.showNames, showArcs: state.showArcs, showAngles: state.showAngles,
    });
    render();
  }

  resetBtn.addEventListener("click", reset);
  namesBox.addEventListener("change", () => { state = Core.toggle(state, "showNames"); render(); });
  arcsBox.addEventListener("change", () => { state = Core.toggle(state, "showArcs"); render(); });
  anglesBox.addEventListener("change", () => { state = Core.toggle(state, "showAngles"); render(); });
  document.querySelectorAll("[data-slide]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state = Core.slide(state, btn.dataset.which, Number(btn.dataset.slide));
      render();
    });
  });

  board.onTheme(render);
  render();
})();
