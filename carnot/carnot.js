"use strict";

/*
 * The page for Carnot: drawing and input only; the theorem is in
 * carnot-core.js. The SVG holds a circle with four draggable points on it —
 * the triangle A, B, C and the point P. From P, three lines leave at the same
 * angle to the sides; their feet A', B', C' are joined by one straight line.
 * The two optional overlays (similar triangles and circles through two feet)
 * are the ones the applet shows when its checkboxes are ticked.
 */

(function () {
  const Core = CarnotCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const angleRange = document.getElementById("angleRange");
  const angleOut = document.getElementById("angleOut");
  const similarBox = document.getElementById("similarBox");
  const circlesBox = document.getElementById("circlesBox");
  const namesBox = document.getElementById("namesBox");
  const pairBtn = document.getElementById("pairBtn");
  const newBtn = document.getElementById("newBtn");

  const view = board.viewBox;
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start({ angle: Number(angleRange.value) });

  const circleLayer = board.layer("circle");
  const sidesLayer = board.layer("sides");
  const slantsLayer = board.layer("slants");
  const marksLayer = board.layer("marks");
  const overlaysLayer = board.layer("overlays");
  const handlesLayer = board.layer("handles");

  /* Each object is made once and only its geometry changes on a redraw. */
  const circumcircle = board.circle(state.circle, state.circle.r, "circum-circle", circleLayer);
  const sides = [
    board.segment(state.A, state.B, "tri-side", sidesLayer),
    board.segment(state.B, state.C, "tri-side", sidesLayer),
    board.segment(state.C, state.A, "tri-side", sidesLayer),
  ];
  const slants = [
    board.line(state.P, state.A, "slant", slantsLayer),
    board.line(state.P, state.B, "slant", slantsLayer),
    board.line(state.P, state.C, "slant", slantsLayer),
  ];
  const rule = board.line(state.A, state.B, "rule-line", slantsLayer);
  const footDots = [
    board.point(state.A, "foot-dot", 4, marksLayer),
    board.point(state.B, "foot-dot", 4, marksLayer),
    board.point(state.C, "foot-dot", 4, marksLayer),
  ];
  const slantArcs = [
    board.angleArc(state.A, state.B, state.P, 13, "slant-arc", marksLayer),
    board.angleArc(state.B, state.C, state.P, 13, "slant-arc", marksLayer),
    board.angleArc(state.C, state.A, state.P, 13, "slant-arc", marksLayer),
  ];
  const fillTriangles = [
    board.polygon([state.A, state.B, state.C], "similar-fill", overlaysLayer),
    board.polygon([state.A, state.B, state.C], "similar-fill alt", overlaysLayer),
  ];
  const pairCircles = [
    board.circle(state.A, 1, "pair-circle", overlaysLayer),
    board.circle(state.A, 1, "pair-circle alt", overlaysLayer),
  ];
  const labels = [
    board.label(state.A, "A", "glabel", -19, -10, marksLayer),
    board.label(state.B, "B", "glabel", -19, 22, marksLayer),
    board.label(state.C, "C", "glabel", 9, 8, marksLayer),
    board.label(state.P, "P", "glabel point-label", 9, -10, marksLayer),
    board.label(state.A, "A'", "glabel foot-label", 8, -9, marksLayer),
    board.label(state.B, "B'", "glabel foot-label", 8, 18, marksLayer),
    board.label(state.C, "C'", "glabel foot-label", -28, 8, marksLayer),
  ];

  /**
   * The line under the picture. An illustration has no win or loss: `kind` is
   * never "win" or "lose" here, and the record reads the position through
   * Track.state rather than through a result.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.feet(state);
    const A = state.A, B = state.B, C = state.C, P = state.P;
    const feet = [f.Ap, f.Bp, f.Cp];
    const ends = [[B, C], [C, A], [A, B]];
    const finite = feet.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    circumcircle.set(state.circle, state.circle.r);
    sides[0].set(A, B);
    sides[1].set(B, C);
    sides[2].set(C, A);

    for (let i = 0; i < 3; i++) {
      slants[i].show(finite);
      footDots[i].show(finite);
      slantArcs[i].show(finite);
      if (finite) {
        slants[i].set(P, feet[i]);
        footDots[i].set(feet[i]);
        slantArcs[i].set(feet[i], ends[i][0], P, 13);
      }
    }
    rule.show(finite);
    if (finite) rule.set(feet[0], feet[1]);

    const triple = state.showSimilar ? Core.pair(state) : null;
    for (let i = 0; i < 2; i++) {
      const on = Boolean(triple && triple[i]);
      fillTriangles[i].show(on);
      if (on) fillTriangles[i].set(triple[i]);
    }
    const pairCirclesOn = Boolean(state.showCirclePairs && triple);
    for (let i = 0; i < 2; i++) {
      const t = pairCirclesOn ? triple[i] : null;
      const circ = t ? Core.circumcircle(t[0], t[1], t[2]) : null;
      const ok = Boolean(circ && Number.isFinite(circ.r) && circ.r < view.width * 2);
      pairCircles[i].show(ok);
      if (ok) pairCircles[i].set(circ, circ.r);
    }

    labels[0].set(A);
    labels[1].set(B);
    labels[2].set(C);
    labels[3].set(P);
    labels[4].set(f.Ap);
    labels[5].set(f.Bp);
    labels[6].set(f.Cp);
    for (let i = 0; i < 4; i++) labels[i].show(state.showNames);
    for (let i = 4; i < 7; i++) labels[i].show(state.showNames && finite);

    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);
    hP.set(state.P);

    angleOut.textContent = String(state.angle);
    pairBtn.textContent = `Next pair (${state.pair + 1}/3)`;
    pairBtn.disabled = !state.showSimilar && !state.showCirclePairs;

    if (!finite) {
      say("Move the points apart so the three sloping lines meet the sides.", null);
    } else {
      const extra = pairBtn.disabled ? "" : ` Pair ${state.pair + 1} of 3 is highlighted.`;
      say(`A', B' and C' lie on one line at ${state.angle}° (Menelaus product ${fmt(Core.menelaus(state))}).${extra}`, null);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const onCircle = (p) => Core.projectOnCircle(p, state.circle);
  const handleOptions = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: onCircle,
    label: `${name} on the circumcircle. Drag it, or focus it and use the arrow keys to slide it round`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint(name, p),
  });
  const hA = board.handle("A", state.A, handleOptions("A"));
  const hB = board.handle("B", state.B, handleOptions("B"));
  const hC = board.handle("C", state.C, handleOptions("C"));
  const hP = board.handle("P", state.P, handleOptions("P"));

  function newGame() {
    state = Core.start();
    syncControls();
    render();
    hP.node.focus();
  }

  function syncControls() {
    angleRange.value = String(state.angle);
    similarBox.checked = state.showSimilar;
    circlesBox.checked = state.showCirclePairs;
    namesBox.checked = state.showNames;
  }

  angleRange.addEventListener("input", () => {
    state = Core.withAngle(state, Number(angleRange.value));
    render();
  });
  similarBox.addEventListener("change", () => {
    state = Core.withOption(state, "showSimilar", similarBox.checked);
    render();
  });
  circlesBox.addEventListener("change", () => {
    state = Core.withOption(state, "showCirclePairs", circlesBox.checked);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.withOption(state, "showNames", namesBox.checked);
    render();
  });
  pairBtn.addEventListener("click", () => {
    state = Core.nextPair(state);
    render();
  });
  newBtn.addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "r" || e.key === "R") newGame();
    if ((e.key === "n" || e.key === "N") && !pairBtn.disabled) {
      state = Core.nextPair(state);
      render();
    }
  });

  board.onTheme(render);
  syncControls();
  render();
})();
