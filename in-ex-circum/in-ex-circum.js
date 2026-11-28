"use strict";

/*
 * The page for In Ex Circum: drawing and input only; the geometry is in
 * in-ex-circum-core.js. An SVG holds a draggable triangle ABC, its incenter I
 * and excentres Ia/Ib/Ic, the three halfway dots Ma/Mb/Mc, the incircle and
 * excircles, and the circumcircle. Six buttons switch the same overlays as the
 * applet's checkboxes (names, claim, hint 1, hint 2); Reset restores its start.
 */

(function () {
  const Core = InExCircumCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const claimBtn = document.getElementById("claimBtn");
  const hint1Btn = document.getElementById("hint1Btn");
  const hint2Btn = document.getElementById("hint2Btn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 14, view.x + view.width - 14),
    y: Geom.clamp(p.y, view.y + 14, view.y + view.height - 14),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();
  let checked = false;
  let showNames = true;
  let showClaim = false;
  let showHint1 = false;
  let showHint2 = false;

  /* Painted back to front: circles and excentral sides, guides, dots, labels. */
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
  const triSides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const exSides = [
    board.line(state.A, state.B, "ex-side", guides),
    board.line(state.B, state.C, "ex-side", guides),
    board.line(state.C, state.A, "ex-side", guides),
  ];
  const bisectors = [
    board.line(state.A, state.B, "bisector", guides),
    board.line(state.B, state.C, "bisector", guides),
    board.line(state.C, state.A, "bisector", guides),
  ];
  const claimLines = [
    board.segment(state.A, state.B, "claim-line claim-one", guides),
    board.segment(state.A, state.B, "claim-line claim-one", guides),
    board.segment(state.A, state.B, "claim-line claim-two", guides),
    board.segment(state.A, state.B, "claim-line claim-two", guides),
    board.segment(state.A, state.B, "claim-line claim-three", guides),
    board.segment(state.A, state.B, "claim-line claim-three", guides),
  ];
  const angleMarks = [
    board.angleArc(state.A, state.B, state.C, 18, "angle-mark", guides),
    board.angleArc(state.A, state.B, state.C, 18, "angle-mark", guides),
    board.angleArc(state.A, state.B, state.C, 18, "angle-mark", guides),
    board.angleArc(state.A, state.B, state.C, 18, "angle-mark", guides),
    board.angleArc(state.A, state.B, state.C, 18, "angle-mark", guides),
    board.angleArc(state.A, state.B, state.C, 18, "angle-mark", guides),
  ];
  const rightMarks = [
    board.rightAngle(state.A, state.B, state.C, 10, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 10, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 10, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 10, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 10, "right-mark", guides),
    board.rightAngle(state.A, state.B, state.C, 10, "right-mark", guides),
  ];

  const I = board.point(state.A, "in-dot", 5, marks);
  const exDots = [0, 1, 2].map(() => board.point(state.A, "ex-dot", 4.5, marks));
  const midDots = [0, 1, 2].map(() => board.point(state.A, "mid-dot", 5.5, marks));

  const vertexLabels = [
    board.label(state.A, "A", "glabel", -18, 22, labelsLayer),
    board.label(state.B, "B", "glabel", 8, 22, labelsLayer),
    board.label(state.C, "C", "glabel", -4, -12, labelsLayer),
  ];
  const centerLabels = [
    board.label(state.A, "I", "glabel in-label", -17, -9, labelsLayer),
    board.label(state.A, "Ia", "glabel ex-label", 8, -9, labelsLayer),
    board.label(state.A, "Ib", "glabel ex-label", 8, -9, labelsLayer),
    board.label(state.A, "Ic", "glabel ex-label", 8, 18, labelsLayer),
  ];
  const midLabels = [
    board.label(state.A, "Ma", "glabel mid-label", 8, -9, labelsLayer),
    board.label(state.A, "Mb", "glabel mid-label", 8, -9, labelsLayer),
    board.label(state.A, "Mc", "glabel mid-label", 8, 18, labelsLayer),
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
    const live = !m.degenerate && Boolean(m.I && m.ex && m.mid && m.O);
    const ex = live ? [m.ex.Ia, m.ex.Ib, m.ex.Ic] : null;
    const mid = live ? [m.mid.Ma, m.mid.Mb, m.mid.Mc] : null;

    triSides[0].set(state.A, state.B);
    triSides[1].set(state.B, state.C);
    triSides[2].set(state.C, state.A);
    vertexLabels[0].set(state.A);
    vertexLabels[1].set(state.B);
    vertexLabels[2].set(state.C);

    incircle.show(live);
    for (const c of excircles) c.show(live);
    circumcircle.show(live);
    for (const s of exSides) s.show(live && (showHint1 || showHint2));
    for (const b of bisectors) b.show(live && showHint2);
    for (const l of claimLines) l.show(live && showClaim);
    for (const a of angleMarks) a.show(live && showHint1);
    for (const r of rightMarks) r.show(live && showHint2);
    I.show(live);
    for (const dot of exDots) dot.show(live);
    for (const dot of midDots) dot.show(live);
    for (const label of centerLabels.concat(midLabels)) label.show(live && showNames);

    if (live) {
      incircle.set(m.incircle.center, m.incircle.radius);
      for (let i = 0; i < 3; i++) {
        const key = ["Ia", "Ib", "Ic"][i];
        excircles[i].set(m.excircles[key].center, m.excircles[key].radius);
        exDots[i].set(ex[i]);
        midDots[i].set(mid[i]);
        centerLabels[i + 1].set(ex[i]);
        midLabels[i].set(mid[i]);
      }
      I.set(m.I);
      circumcircle.set(m.O, m.R);
      circumcircle.node.setAttribute("class", showClaim ? "circumcircle claimed" : "circumcircle");

      const exPairs = [[ex[0], ex[1]], [ex[1], ex[2]], [ex[2], ex[0]]];
      for (let i = 0; i < 3; i++) exSides[i].set(exPairs[i][0], exPairs[i][1]);
      const vertexEx = [ex[0], ex[1], ex[2]];
      for (let i = 0; i < 3; i++) bisectors[i].set([state.A, state.B, state.C][i], vertexEx[i]);

      // The claim joins the incenter and each excentre to their halfway point.
      const pairs = [
        [m.I, mid[0]], [ex[0], mid[0]],
        [m.I, mid[1]], [ex[1], mid[1]],
        [m.I, mid[2]], [ex[2], mid[2]],
      ];
      for (let i = 0; i < 6; i++) claimLines[i].set(pairs[i][0], pairs[i][1]);

      // The six angle marks and six right angles at A, B and C, as in Hint 1/2.
      const marksAt = [
        [state.A, state.C, ex[1]], [state.A, ex[2], state.B],
        [state.B, state.A, ex[2]], [state.B, ex[0], state.C],
        [state.C, state.B, ex[0]], [state.C, ex[1], state.A],
      ];
      const rightAt = [
        [state.A, ex[0], ex[1]], [state.A, ex[2], ex[0]],
        [state.B, ex[1], ex[2]], [state.B, ex[0], ex[1]],
        [state.C, ex[2], ex[0]], [state.C, ex[1], ex[2]],
      ];
      for (let i = 0; i < 6; i++) {
        angleMarks[i].set(marksAt[i][0], marksAt[i][1], marksAt[i][2], 18);
        rightMarks[i].set(rightAt[i][0], rightAt[i][1], rightAt[i][2], 10);
      }
      centerLabels[0].set(m.I);
    }

    if (!live) {
      say("Move the corners apart to make a triangle.", null);
    } else if (checked && Object.values(Core.claims(state)).every(Boolean)) {
      say("Done: Ma, Mb and Mc sit on the circle, each at the middle of its arc.", "done");
    } else if (checked) {
      say("Check again after moving the corners apart.", null);
    } else {
      say(
        `OMa = ${fmt(Core.distance(m.O, mid[0]))}, OMb = ${fmt(Core.distance(m.O, mid[1]))}, OMc = ${fmt(Core.distance(m.O, mid[2]))}; circle radius ${fmt(m.R)}. Press Check midpoints.`,
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

  const handleOpts = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
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
  claimBtn.addEventListener("click", () =>
    toggle(claimBtn, () => showClaim, (v) => { showClaim = v; }, "Show claim", "Hide claim"));
  hint1Btn.addEventListener("click", () =>
    toggle(hint1Btn, () => showHint1, (v) => { showHint1 = v; }, "Show angle marks", "Hide angle marks"));
  hint2Btn.addEventListener("click", () =>
    toggle(hint2Btn, () => showHint2, (v) => { showHint2 = v; }, "Show bisectors", "Hide bisectors"));
  checkBtn.addEventListener("click", checkClaims);

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "n") namesBtn.click();
    else if (k === "c") claimBtn.click();
    else if (k === "1") hint1Btn.click();
    else if (k === "2") hint2Btn.click();
    else if (k === "v") checkClaims();
  });

  board.onTheme(render);
  render();
})();
