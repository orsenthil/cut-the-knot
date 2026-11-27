"use strict";

/*
 * The page for Circumcenter on Angle Bisector: drawing and input only; the
 * construction is in circumcenter-on-angle-bisector-core.js. An SVG holds a
 * triangle with three draggable corners. The circle through B, I and C has its
 * centre O on the bisector from A; the excenter E finishes the diameter IE.
 * The four toggles follow the applet's "names / statement / premise / hint".
 */

(function () {
  const Core = CircumcenterOnAngleBisectorCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const premiseBtn = document.getElementById("premiseBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);

  let state = Core.start();
  let checked = false;
  let show = { names: true, statement: false, premise: false, hint: false };

  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Built once; every redraw only calls .set() and .show() on these objects. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const circle = board.circle(state.A, 1, "bic-circle", shapes);
  const ai = board.line(state.A, state.B, "bisector ai-line", shapes);
  const bisectors = [
    board.line(state.A, state.B, "bisector", shapes),
    board.line(state.B, state.C, "bisector", shapes),
  ];
  const externals = [
    board.line(state.B, state.C, "external", guides),
    board.line(state.C, state.B, "external", guides),
  ];
  const diameter = board.segment(state.A, state.B, "diameter", guides);
  const footDots = [
    board.point(state.A, "foot-dot", 3, marks),
    board.point(state.B, "foot-dot", 3, marks),
  ];
  const iDot = board.point(state.A, "center-dot", 5, marks);
  const oDot = board.point(state.A, "circum-dot", 5, marks);
  const eDot = board.point(state.A, "excenter-dot", 4, marks);
  const kDot = board.point(state.A, "mid-dot", 3, marks);
  const lDot = board.point(state.A, "mid-dot", 3, marks);
  const rightK = board.rightAngle(state.A, state.B, state.C, 8, "right-mark", marks);
  const rightL = board.rightAngle(state.A, state.B, state.C, 8, "right-mark", marks);
  const arcs = [
    board.angleArc(state.B, state.A, state.C, 24, "half-arc", marks),
    board.angleArc(state.C, state.A, state.B, 24, "half-arc", marks),
  ];
  const names = [
    board.label(state.A, "A", "glabel", -20, 24, labels),
    board.label(state.B, "B", "glabel", -20, -10, labels),
    board.label(state.C, "C", "glabel", 10, 6, labels),
    board.label(state.A, "I", "glabel i-label", 8, -8, labels),
    board.label(state.A, "O", "glabel o-label", 8, 18, labels),
    board.label(state.A, "E", "glabel e-label", 8, -8, labels),
    board.label(state.A, "K", "glabel k-label", -18, -8, labels),
    board.label(state.A, "L", "glabel l-label", -18, -8, labels),
  ];

  /**
   * The status line under the board. "done" is how the player's record learns
   * that the illustration has been checked; there is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const ok = !m.degenerate;

    sides[0].set(state.A, state.B);
    sides[1].set(state.B, state.C);
    sides[2].set(state.C, state.A);

    circle.show(ok && finite(m.O) && Number.isFinite(m.r));
    if (ok) circle.set(m.O, m.r);

    ai.set(...m.lines.Ai);
    ai.node.setAttribute("class", show.statement ? "bisector ai-line on" : "bisector ai-line");
    for (const [line, pair] of [[bisectors[0], m.lines.Bi], [bisectors[1], m.lines.Ci]]) {
      line.show(ok && finite(pair[0]) && finite(pair[1]));
      line.set(...pair);
    }
    for (const [line, pair] of [[externals[0], m.lines.Be], [externals[1], m.lines.Ce]]) {
      line.show(show.hint && ok && finite(pair[0]) && finite(pair[1]));
      line.set(...pair);
    }
    diameter.show(show.hint && ok && finite(m.I) && finite(m.E));
    if (ok) diameter.set(m.I, m.E);

    for (const [dot, foot] of [[footDots[0], m.feet.B], [footDots[1], m.feet.C]]) {
      dot.show(show.premise && ok && finite(foot));
      if (finite(foot)) dot.set(foot);
    }
    iDot.show(ok);
    oDot.show(ok);
    if (ok) { iDot.set(m.I); oDot.set(m.O); }
    oDot.node.setAttribute("r", show.statement ? 7 : 5);
    eDot.show(show.hint && ok && finite(m.E));
    if (finite(m.E)) eDot.set(m.E);
    kDot.show(show.premise && ok && finite(m.K));
    lDot.show(show.premise && ok && finite(m.L));
    if (finite(m.K)) kDot.set(m.K);
    if (finite(m.L)) lDot.set(m.L);
    rightK.show(show.premise && ok && finite(m.K));
    rightL.show(show.premise && ok && finite(m.L));
    if (ok) {
      rightK.set(m.K, m.O, m.I, 8);
      rightL.set(m.L, m.O, m.I, 8);
    }
    arcs[0].show(show.hint && ok && finite(m.feet.B));
    arcs[1].show(show.hint && ok && finite(m.feet.C));
    if (finite(m.feet.B)) arcs[0].set(state.B, state.A, m.feet.B, 24);
    if (finite(m.feet.C)) arcs[1].set(state.C, state.A, m.feet.C, 24);

    const at = [state.A, state.B, state.C, m.I, m.O, m.E, m.K, m.L];
    const showName = [true, true, true, true, true, show.hint, show.premise, show.premise];
    for (let i = 0; i < names.length; i++) {
      names[i].show(show.names && showName[i] && ok && finite(at[i]));
      if (finite(at[i])) names[i].set(at[i]);
    }

    if (!ok) {
      say("Move the corners apart to make a triangle.", null);
    } else if (checked) {
      say("O lies on AI: the centre of the circle through B, I and C is on the bisector from A.", "done");
    } else if (show.statement) {
      say("O is the midpoint of IE, so A, I, O and E are all on the same line.", null);
    } else if (show.hint) {
      say("The two outer bisectors meet at E. IE is a diameter of the circle through B, I and C.", null);
    } else {
      say("Drag A, B or C. The circle through B, I and C always has its centre O on the bisector from A.", null);
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
  const handleOpts = (name, label) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    label: label,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const hA = board.handle("A", state.A, handleOpts("A", "Corner A. Drag, or focus and use the arrow keys to move it."));
  const hB = board.handle("B", state.B, handleOpts("B", "Corner B. Drag, or focus and use the arrow keys to move it."));
  const hC = board.handle("C", state.C, handleOpts("C", "Corner C. Drag, or focus and use the arrow keys to move it."));
  for (const [handle, name] of [[hA, "A"], [hB, "B"], [hC, "C"]]) {
    handle.onMove((p) => moveVertex(name, p));
  }

  function toggle(which, btn, onText, offText) {
    show[which] = !show[which];
    btn.setAttribute("aria-pressed", String(show[which]));
    btn.textContent = show[which] ? offText : onText;
    render();
  }

  function newGame() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }

  function checkClaims() {
    const result = Core.claims(state);
    checked = result.all;
    render();
    if (!result.all) say("Move the corners apart, then check again.", null);
  }

  newBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", checkClaims);
  namesBtn.addEventListener("click", () => toggle("names", namesBtn, "Show names", "Hide names"));
  statementBtn.addEventListener("click", () => toggle("statement", statementBtn, "Show statement", "Hide statement"));
  premiseBtn.addEventListener("click", () => toggle("premise", premiseBtn, "Show premise", "Hide premise"));
  hintBtn.addEventListener("click", () => toggle("hint", hintBtn, "Show hint", "Hide hint"));
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
