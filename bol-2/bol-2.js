"use strict";

/*
 * The page for BOL2: drawing and input only; the geometry is in
 * bol-2-core.js. An SVG holds the semicircle on AB, a draggable point D on
 * the arc, the two tangents meeting at T, the perpendicular DE, and the
 * crossing F. A second and third handle slide the ends of the diameter along
 * its baseline. The three checkboxes reproduce the applet's "Show names",
 * "Show hint" and "Show statement" switches.
 */

(function () {
  const Core = Bol2Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const statementBox = document.getElementById("statementBox");

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");
  let state = Core.start({
    showNames: namesBox.checked,
    showHint: hintBox.checked,
    showStatement: statementBox.checked,
  });
  let checked = false;
  let hA, hB, hD;

  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Objects are made once and only their geometry changes on a redraw, so a
   * handle keeps keyboard focus across every move. */
  const arc = board.arc(state.A, 1, Math.PI, 2 * Math.PI, "arc", shapes);
  const diameter = board.segment(state.A, state.B, "diameter", shapes);
  const tangentB = board.line(state.B, state.B, "tangent", shapes);
  const tangentD = board.line(state.D, state.D, "tangent alt", shapes);
  const guideAT = board.line(state.A, state.B, "guide", shapes);
  const guideAD = board.line(state.A, state.B, "guide hint-line", shapes);
  const perpDE = board.segment(state.D, state.A, "perp", shapes);
  const segDF = board.segment(state.D, state.A, "equal-seg", shapes);
  const segFE = board.segment(state.A, state.B, "equal-seg alt", shapes);
  const hintCircle = board.circle(state.B, 1, "hint-circle", shapes);

  const dotE = board.point(state.A, "foot-dot", 4, marks);
  const dotF = board.point(state.A, "mid-dot", 5, marks);
  const dotT = board.point(state.B, "t-dot", 5, marks);
  const dotH = board.point(state.B, "hint-dot", 4.5, marks);
  const rightE = board.rightAngle(state.A, state.B, state.D, 11, "right-mark", marks);
  const rightD = board.rightAngle(state.D, state.A, state.B, 12, "right-mark hint-mark", marks);
  const labels = {
    A: board.label(state.A, "A", "glabel", -18, 24, marks),
    B: board.label(state.B, "B", "glabel", 8, 24, marks),
    D: board.label(state.D, "D", "glabel", 9, -9, marks),
    E: board.label(state.A, "E", "glabel", -16, 24, marks),
    F: board.label(state.A, "F", "glabel", 9, -9, marks),
    T: board.label(state.B, "T", "glabel", 9, -9, marks),
    H: board.label(state.B, "H", "glabel hint-label", 9, -9, marks),
  };
  const statement = board.label(state.D, "DF = FE", "glabel statement", 12, -28, marks);

  /**
   * Shows a line under the diagram. `kind` is "done" once the claim has been
   * checked; that class is how the player's record sees an explored demo.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const { A, B, D, E, F, T, H, O, radius } = m;
    const all = Core.claims(state);
    const good = Boolean(all && Object.values(all).every(Boolean));
    if (checked && !good) checked = false;

    arc.set(O, radius, Math.PI, 2 * Math.PI);
    diameter.set(A, B);

    const perpB = { x: -(B.y - A.y), y: B.x - A.x };
    const perpD = { x: -(D.y - O.y), y: D.x - O.x };
    tangentB.set(B, { x: B.x + perpB.x, y: B.y + perpB.y });
    tangentD.set(D, { x: D.x + perpD.x, y: D.y + perpD.y });
    guideAT.set(A, T);
    guideAD.set(A, H);
    perpDE.set(D, E);
    segDF.set(D, F);
    segFE.set(F, E);
    hintCircle.set(T, m.TB);
    guideAD.show(state.showHint);
    hintCircle.show(state.showHint);
    rightD.show(state.showHint);
    labels.H.show(state.showHint && state.showNames);
    dotH.show(state.showHint);

    dotE.set(E);
    dotF.set(F);
    dotT.set(T);
    dotH.set(H);
    rightE.set(E, A, D, 11);
    rightD.set(D, A, B, 12);
    labels.A.set(A);
    labels.B.set(B);
    labels.D.set(D);
    labels.E.set(E);
    labels.F.set(F);
    labels.T.set(T);
    labels.H.set(H);
    for (const key of ["A", "B", "D", "E", "F", "T"]) {
      labels[key].show(state.showNames);
    }
    statement.show(state.showStatement);
    statement.set(D, "DF = FE", 12, -28);

    if (hA) hA.set(A);
    if (hB) hB.set(B);
    if (hD) hD.set(D);

    if (!good) {
      say("Move D back onto the arc between the two ends.", null);
    } else if (checked) {
      say("Checked: F is exactly halfway along DE, so DF = FE — just as Archimedes claimed.", "done");
    } else {
      say(`DF = ${fmt(m.DF)} and FE = ${fmt(m.FE)}. Press Check the claim to test it.`, null);
    }

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moved(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  /* A and B slide along the baseline; D snaps to the visible part of the arc. */
  hA = board.handle("A", state.A, {
    r: 8, step: 3, shift: 12, layer: handlesLayer,
    clamp: (p) => ({ x: Geom.clamp(p.x, 20, state.B.x - 60), y: state.A.y }),
    label: "Point A, left end of the diameter. Drag along the baseline, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moved("A", p),
  });
  hB = board.handle("B", state.B, {
    r: 8, step: 3, shift: 12, layer: handlesLayer,
    clamp: (p) => ({ x: Geom.clamp(p.x, state.A.x + 60, 400), y: state.B.y }),
    label: "Point B, right end of the diameter. Drag along the baseline, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moved("B", p),
  });
  hD = board.handle("D", state.D, {
    r: 10, step: 2, shift: 10, layer: handlesLayer,
    clamp: (p) => {
      const m = Core.measurements(state);
      return Core.clampToArc(p, m.O, m.radius);
    },
    label: "Point D on the semicircle. Drag it, or focus it and use the arrow keys.",
    describe: (p) => `on the arc at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => moved("D", p),
  });

  function reset() {
    state = Core.start({
      A: { x: 60, y: 270 },
      B: { x: 360, y: 270 },
      showNames: namesBox.checked,
      showHint: hintBox.checked,
      showStatement: statementBox.checked,
    });
    checked = false;
    render();
    hD.node.focus();
  }

  function checkClaim() {
    checked = true;
    render();
    if (!checked) say("Move D onto the arc between the two ends, then check again.", null);
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBox.addEventListener("change", () => {
    state = { ...state, showNames: namesBox.checked };
    render();
  });
  hintBox.addEventListener("change", () => {
    state = { ...state, showHint: hintBox.checked };
    render();
  });
  statementBox.addEventListener("change", () => {
    state = { ...state, showStatement: statementBox.checked };
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "c") checkClaim();
    else if (key === "n") { namesBox.checked = !namesBox.checked; namesBox.dispatchEvent(new Event("change")); }
    else if (key === "h") { hintBox.checked = !hintBox.checked; hintBox.dispatchEvent(new Event("change")); }
    else if (key === "s") { statementBox.checked = !statementBox.checked; statementBox.dispatchEvent(new Event("change")); }
  });

  board.onTheme(render);
  render();
})();
