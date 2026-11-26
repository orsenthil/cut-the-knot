"use strict";

/*
 * The page for Bevan Point: drawing and input only; the geometry is in
 * bevan-point-core.js. An SVG holds a draggable triangle ABC, its excentral
 * triangle IaIbIc, the incircle and excircles, the circumcircle of ABC and the
 * Bevan circle. Four buttons switch the same overlays as the applet's
 * checkboxes (names, claim 1, claim 2, hint); Reset returns to its start.
 */

(function () {
  const Core = BevanPointCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const claim1Btn = document.getElementById("claim1Btn");
  const claim2Btn = document.getElementById("claim2Btn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 130, view.x + view.width - 130),
    y: Geom.clamp(p.y, view.y + 145, view.y + view.height - 70),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();
  let checked = false;
  let showNames = true;
  let showClaim1 = false;
  let showClaim2 = false;
  let showHint = false;

  /* Painted back to front: circles, excentral triangle, guides, points. */
  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const incircle = board.circle(state.A, 1, "incircle", shapes);
  const excircles = [
    board.circle(state.A, 1, "excircle", shapes),
    board.circle(state.A, 1, "excircle", shapes),
    board.circle(state.A, 1, "excircle", shapes),
  ];
  const circumcircle = board.circle(state.A, 1, "circumcircle", shapes);
  const bevanCircle = board.circle(state.A, 1, "bevan-circle", shapes);

  const exSides = [
    board.segment(state.A, state.B, "ex-side", shapes),
    board.segment(state.A, state.B, "ex-side", shapes),
    board.segment(state.A, state.B, "ex-side", shapes),
  ];
  const triSides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const bisectors = [
    board.line(state.A, state.B, "bisector", guides),
    board.line(state.B, state.C, "bisector", guides),
    board.line(state.C, state.A, "bisector", guides),
  ];
  const ivLine = board.line(state.A, state.B, "claim-line", guides);
  const spokeLines = [
    board.segment(state.A, state.B, "spoke", guides),
    board.segment(state.A, state.B, "spoke", guides),
    board.segment(state.A, state.B, "spoke", guides),
  ];
  const rightMarks = [
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", marks),
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", marks),
    board.rightAngle(state.A, state.B, state.C, 11, "right-mark", marks),
  ];

  const I = board.point(state.A, "in-dot", 4.5, marks);
  const O = board.point(state.A, "center-dot", 5, marks);
  const V = board.point(state.A, "bevan-dot", 5.5, marks);
  const exDots = [
    board.point(state.A, "ex-dot", 4.5, marks),
    board.point(state.A, "ex-dot", 4.5, marks),
    board.point(state.A, "ex-dot", 4.5, marks),
  ];
  const footDots = [
    board.point(state.A, "foot-dot", 3.5, marks),
    board.point(state.A, "foot-dot", 3.5, marks),
    board.point(state.A, "foot-dot", 3.5, marks),
  ];

  const vertexLabels = [
    board.label(state.A, "A", "glabel", -18, 22, labelsLayer),
    board.label(state.B, "B", "glabel", 8, 22, labelsLayer),
    board.label(state.C, "C", "glabel", -4, -12, labelsLayer),
  ];
  const centerLabels = [
    board.label(state.A, "I", "glabel center-label", -18, -9, labelsLayer),
    board.label(state.A, "O", "glabel center-label", 7, -9, labelsLayer),
    board.label(state.A, "V", "glabel bevan-label", 7, -9, labelsLayer),
  ];
  const exLabels = [
    board.label(state.A, "Ia", "glabel ex-label", -10, -9, labelsLayer),
    board.label(state.A, "Ib", "glabel ex-label", -10, -9, labelsLayer),
    board.label(state.A, "Ic", "glabel ex-label", -10, 18, labelsLayer),
  ];

  /**
   * Shows a line under the picture. "done" marks an explored illustration;
   * the shared record reads that class, so no win or loss is ever reported.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const live = !m.degenerate && Boolean(m.V && m.O && m.I && m.feet);
    const ex = live ? [m.ex.Ia, m.ex.Ib, m.ex.Ic] : null;

    triSides[0].set(state.A, state.B);
    triSides[1].set(state.B, state.C);
    triSides[2].set(state.C, state.A);
    vertexLabels[0].set(state.A);
    vertexLabels[1].set(state.B);
    vertexLabels[2].set(state.C);
    for (const label of vertexLabels) label.show(showNames);

    incircle.show(live);
    for (const c of excircles) c.show(live);
    circumcircle.show(live);
    bevanCircle.show(live);
    for (const s of exSides) s.show(live);
    for (const dot of [I, O, V]) dot.show(live);
    for (const dot of exDots) dot.show(live);
    for (const dot of footDots) dot.show(live && showClaim1);
    for (const label of centerLabels) label.show(live && showNames);
    for (const label of exLabels) label.show(live && showNames);
    for (const mark of rightMarks) mark.show(live && showClaim1);
    for (const b of bisectors) b.show(live && showHint);
    for (const s of spokeLines) s.show(live && showClaim1);
    ivLine.show(live && showClaim2);

    if (live) {
      incircle.set(m.incircle.center, m.incircle.radius);
      excircles[0].set(m.excircles.Ia.center, m.excircles.Ia.radius);
      excircles[1].set(m.excircles.Ib.center, m.excircles.Ib.radius);
      excircles[2].set(m.excircles.Ic.center, m.excircles.Ic.radius);
      circumcircle.set(m.O, m.R);
      bevanCircle.set(m.V, m.Re);

      exSides[0].set(ex[0], ex[1]);
      exSides[1].set(ex[1], ex[2]);
      exSides[2].set(ex[2], ex[0]);
      I.set(m.I);
      O.set(m.O);
      V.set(m.V);
      for (let i = 0; i < 3; i++) exDots[i].set(ex[i]);

      const feet = [m.feet.Ea, m.feet.Eb, m.feet.Ec];
      const corners = [[state.B, ex[0]], [state.C, ex[1]], [state.A, ex[2]]];
      for (let i = 0; i < 3; i++) {
        if (feet[i]) footDots[i].set(feet[i]);
        footDots[i].show(live && showClaim1 && Boolean(feet[i]));
        if (feet[i]) rightMarks[i].set(feet[i], corners[i][0], corners[i][1], 11);
        rightMarks[i].show(live && showClaim1 && Boolean(feet[i]));
        spokeLines[i].set(m.V, ex[i]);
      }

      ivLine.set(
        { x: 2 * m.I.x - m.V.x, y: 2 * m.I.y - m.V.y },
        { x: 2 * m.V.x - m.I.x, y: 2 * m.V.y - m.I.y },
      );
      const bisectorEnds = [ex[0], ex[1], ex[2]];
      bisectors[0].set(state.A, bisectorEnds[0]);
      bisectors[1].set(state.B, bisectorEnds[1]);
      bisectors[2].set(state.C, bisectorEnds[2]);

      centerLabels[0].set(m.I);
      centerLabels[1].set(m.O);
      centerLabels[2].set(m.V);
      for (let i = 0; i < 3; i++) exLabels[i].set(ex[i]);
    }

    if (!live) {
      say("Move the corners apart to make a triangle.", null);
    } else if (checked) {
      say("I, O and V line up with O in the middle; the Bevan circle is twice as big.", "done");
    } else {
      say(
        `IO = ${fmt(Core.distance(m.I, m.O))}, OV = ${fmt(Core.distance(m.O, m.V))}; Bevan radius ${fmt(m.Re)} vs circumradius ${fmt(m.R)}. Drag a corner or press Check the claims.`,
        null,
      );
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const clampVertex = (p) => inside(p);
  const handleOpts = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: `Corner ${name}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const hA = board.handle("A", state.A, { ...handleOpts("A"), onMove: (p) => moveVertex("A", p) });
  const hB = board.handle("B", state.B, { ...handleOpts("B"), onMove: (p) => moveVertex("B", p) });
  const hC = board.handle("C", state.C, { ...handleOpts("C"), onMove: (p) => moveVertex("C", p) });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }

  function toggle(button, get, set, onText, offText) {
    set(!get());
    button.setAttribute("aria-pressed", String(get()));
    button.textContent = get() ? offText : onText;
    render();
  }

  function checkClaims() {
    const cl = Core.claims(state);
    checked = Object.values(cl).every(Boolean);
    render();
    if (!checked) say("Move the corners apart, then check again.", null);
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, () => showNames, (v) => { showNames = v; }, "Show names", "Hide names"));
  claim1Btn.addEventListener("click", () =>
    toggle(claim1Btn, () => showClaim1, (v) => { showClaim1 = v; }, "Show claim 1", "Hide claim 1"));
  claim2Btn.addEventListener("click", () =>
    toggle(claim2Btn, () => showClaim2, (v) => { showClaim2 = v; }, "Show claim 2", "Hide claim 2"));
  hintBtn.addEventListener("click", () =>
    toggle(hintBtn, () => showHint, (v) => { showHint = v; }, "Show angle bisectors", "Hide angle bisectors"));
  checkBtn.addEventListener("click", checkClaims);

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "n") namesBtn.click();
    else if (k === "1") claim1Btn.click();
    else if (k === "2") claim2Btn.click();
    else if (k === "h") hintBtn.click();
    else if (k === "c") checkClaims();
  });

  board.onTheme(render);
  render();
})();
