"use strict";

/*
 * The page for Cabart Collinearity: drawing and input only; the geometry is in
 * cabart-collinearity-core.js. An SVG holds the triangle with three draggable
 * corners. Checkboxes add the two triples of isosceles triangles, their
 * Kiepert points and cevians, and the nine-point circle; the slider is the
 * applet's base-angle scrollbar (0..95, starting at 45). A blue line through
 * the two Kiepert points and the nine-point centre is always drawn.
 */

(function () {
  const Core = CabartCollinearityCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const angleEl = document.getElementById("angle");
  const angleOut = document.getElementById("angleOut");
  const downBtn = document.getElementById("downBtn");
  const upBtn = document.getElementById("upBtn");
  const newBtn = document.getElementById("newBtn");
  const boxes = {
    showOuter: document.getElementById("showOuter"),
    showInner: document.getElementById("showInner"),
    show9PC: document.getElementById("show9PC"),
    showNames: document.getElementById("showNames"),
  };

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });

  let state = Core.start();
  const initial = Core.measure(state); // finite placeholders for the drawn objects

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* One SVG element per object; .set() keeps the focused handle alive. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const outerSides = [
    board.segment(state.A, initial.Cp, "apex-side outer", guides),
    board.segment(initial.Cp, state.B, "apex-side outer", guides),
    board.segment(state.B, initial.Ap, "apex-side outer", guides),
    board.segment(initial.Ap, state.C, "apex-side outer", guides),
    board.segment(state.C, initial.Bp, "apex-side outer", guides),
    board.segment(initial.Bp, state.A, "apex-side outer", guides),
  ];
  const innerSides = [
    board.segment(state.A, initial.Cm, "apex-side inner", guides),
    board.segment(initial.Cm, state.B, "apex-side inner", guides),
    board.segment(state.B, initial.Am, "apex-side inner", guides),
    board.segment(initial.Am, state.C, "apex-side inner", guides),
    board.segment(state.C, initial.Bm, "apex-side inner", guides),
    board.segment(initial.Bm, state.A, "apex-side inner", guides),
  ];
  const outerCevians = [0, 1, 2].map(() => board.line(state.A, initial.Ap, "cevian outer", shapes));
  const innerCevians = [0, 1, 2].map(() => board.line(state.A, initial.Am, "cevian inner", shapes));
  const collinearLine = board.line(initial.Kp, initial.Km, "collinear-line", shapes);
  const nineCircle = board.circle(state.A, 10, "nine-circle", shapes);

  const outerDots = [0, 1, 2].map(() => board.point(initial.Ap, "apex-dot outer-dot", 4, marks));
  const innerDots = [0, 1, 2].map(() => board.point(initial.Am, "apex-dot inner-dot", 4, marks));
  const kpDot = board.point(state.A, "kiepert-dot outer-dot", 5.5, marks);
  const kmDot = board.point(state.B, "kiepert-dot inner-dot", 5.5, marks);
  const nDot = board.point(state.C, "center-dot", 6, marks);

  const cornerLabels = [
    board.label(state.A, "A", "glabel", -20, 22, marks),
    board.label(state.B, "B", "glabel", -20, -10, marks),
    board.label(state.C, "C", "glabel", 10, 4, marks),
  ];
  const nLabel = board.label(state.C, "N", "glabel center-label", -18, -10, marks);
  const kpLabel = board.label(state.A, "Kₚ", "glabel kp-label", 8, -8, marks);
  const kmLabel = board.label(state.B, "Kₘ", "glabel km-label", 8, -8, marks);
  const outerLabels = [0, 1, 2].map(() => board.label(initial.Ap, "Aₚ", "glabel outer-label", 8, -6, marks));
  const innerLabels = [0, 1, 2].map(() => board.label(initial.Am, "Aₘ", "glabel inner-label", 8, -6, marks));

  /** Status line under the board; an illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    const A = state.A, B = state.B, C = state.C;

    sides[0].set(A, B);
    sides[1].set(B, C);
    sides[2].set(C, A);

    const outerPairs = [[A, m.Cp], [m.Cp, B], [B, m.Ap], [m.Ap, C], [C, m.Bp], [m.Bp, A]];
    const innerPairs = [[A, m.Cm], [m.Cm, B], [B, m.Am], [m.Am, C], [C, m.Bm], [m.Bm, A]];
    for (let i = 0; i < 6; i++) {
      if (m.outerUsable) outerSides[i].set(outerPairs[i][0], outerPairs[i][1]);
      outerSides[i].show(state.showOuter && m.outerUsable);
      if (m.innerUsable) innerSides[i].set(innerPairs[i][0], innerPairs[i][1]);
      innerSides[i].show(state.showInner && m.innerUsable);
    }
    const vertices = [A, B, C];
    for (let i = 0; i < 3; i++) {
      if (m.outerUsable) {
        const oPair = Core.extremePair(vertices[i], [m.Ap, m.Bp, m.Cp][i], m.Kp);
        outerCevians[i].set(oPair[0], oPair[1]);
      }
      outerCevians[i].show(state.showOuter && m.outerUsable);
      if (m.innerUsable) {
        const iPair = Core.extremePair(vertices[i], [m.Am, m.Bm, m.Cm][i], m.Km);
        innerCevians[i].set(iPair[0], iPair[1]);
      }
      innerCevians[i].show(state.showInner && m.innerUsable);
    }

    collinearLine.show(Boolean(m.line));
    if (m.line) collinearLine.set(m.line[0], m.line[1]);
    nineCircle.show(state.show9PC && Number.isFinite(m.radius));
    if (Number.isFinite(m.radius)) nineCircle.set(m.N, m.radius);

    const outerApexes = [m.Ap, m.Bp, m.Cp];
    const innerApexes = [m.Am, m.Bm, m.Cm];
    const outerWords = ["Aₚ", "Bₚ", "Cₚ"];
    const innerWords = ["Aₘ", "Bₘ", "Cₘ"];
    for (let i = 0; i < 3; i++) {
      if (m.outerUsable) {
        outerDots[i].set(outerApexes[i]);
        outerLabels[i].set(outerApexes[i], outerWords[i]);
      }
      outerDots[i].show(state.showOuter && m.outerUsable);
      outerLabels[i].show(state.showNames && state.showOuter && m.outerUsable);
      if (m.innerUsable) {
        innerDots[i].set(innerApexes[i]);
        innerLabels[i].set(innerApexes[i], innerWords[i]);
      }
      innerDots[i].show(state.showInner && m.innerUsable);
      innerLabels[i].show(state.showNames && state.showInner && m.innerUsable);
    }
    cornerLabels[0].set(A);
    cornerLabels[1].set(B);
    cornerLabels[2].set(C);
    for (const l of cornerLabels) l.show(state.showNames);
    kpDot.show(m.outerUsable);
    kmDot.show(m.innerUsable);
    nDot.show(Boolean(m.line));
    kpLabel.show(state.showNames && m.outerUsable);
    kmLabel.show(state.showNames && m.innerUsable);
    nLabel.show(state.showNames && Boolean(m.line));
    if (m.outerUsable) {
      kpDot.set(m.Kp);
      kpLabel.set(m.Kp);
    }
    if (m.innerUsable) {
      kmDot.set(m.Km);
      kmLabel.set(m.Km);
    }
    if (m.line) {
      nDot.set(m.N);
      nLabel.set(m.N);
    }

    angleEl.value = String(state.angle);
    angleOut.textContent = `${state.angle}°`;
    for (const key of Object.keys(boxes)) boxes[key].checked = state[key];

    if (!m.usable) {
      say(`At ${state.angle}° the isosceles triangles collapse. Choose another angle to see the line.`, null);
    } else {
      const err = Math.abs(m.collinearError).toExponential(1);
      say(`At ${state.angle}° the two Kiepert points and the nine-point centre lie on one line (off by ${err} board units).`, null);
    }
    /* The position, for the player's record and the tutor. */
    if (window.Track) window.Track.state(state);
  }

  function moveCorner(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const handleOpts = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: `Corner ${name}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moveCorner(name, p),
  });
  const hA = board.handle("A", state.A, handleOpts("A"));
  const hB = board.handle("B", state.B, handleOpts("B"));
  const hC = board.handle("C", state.C, handleOpts("C"));

  function setAngle(value) {
    state = Core.withOptions(state, { angle: value });
    render();
  }

  angleEl.addEventListener("input", (e) => setAngle(Number(e.target.value)));
  downBtn.addEventListener("click", () => setAngle(state.angle - Core.ANGLE.pageStep));
  upBtn.addEventListener("click", () => setAngle(state.angle + Core.ANGLE.pageStep));
  for (const key of Object.keys(boxes)) {
    boxes[key].addEventListener("change", (e) => {
      state = Core.withOptions(state, { [key]: e.target.checked });
      render();
    });
  }
  newBtn.addEventListener("click", () => {
    state = Core.start();
    render();
    hA.node.focus();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|BUTTON|TEXTAREA)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newBtn.click();
    if (e.key === "[" ) setAngle(state.angle - Core.ANGLE.pageStep);
    if (e.key === "]" ) setAngle(state.angle + Core.ANGLE.pageStep);
  });

  board.onTheme(render);
  render();
})();
