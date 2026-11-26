"use strict";

/*
 * The page for BalticDarij1: drawing and input only; the geometry is in
 * baltic-darij-1-core.js. An SVG holds a triangle with three draggable corners.
 * Every other point — the altitude foot Ha, the bisector foot La, the feet P
 * and Q, the midpoint A' and the point R — is computed by the core and follows
 * the corners. The five checkboxes are the applet's five "Show" options.
 */

(function () {
  const Core = BalticDarij1Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");
  const optionInputs = Array.from(document.querySelectorAll("[data-option]"));

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });

  let state = Core.start();
  let checked = false;

  const circlesLayer = board.layer("circles");
  const guidesLayer = board.layer("guides");
  const shapesLayer = board.layer("shapes");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Each object is made once; a redraw only changes its geometry or visibility. */
  const claimCircle = board.circle(state.A, 1, "claim-circle", circlesLayer);
  const diameterCircle = board.circle(state.A, 1, "diameter-circle", circlesLayer);
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapesLayer),
    board.segment(state.B, state.C, "tri-side", shapesLayer),
    board.segment(state.C, state.A, "tri-side", shapesLayer),
  ];
  const altitude = board.segment(state.A, state.B, "altitude", guidesLayer);
  const bisector = board.line(state.A, state.B, "bisector", guidesLayer);
  const perpB = board.segment(state.B, state.A, "perp-foot", guidesLayer);
  const perpC = board.segment(state.C, state.A, "perp-foot", guidesLayer);
  const legAP = board.segment(state.A, state.B, "midline", shapesLayer);
  const legAQ = board.segment(state.A, state.B, "midline", shapesLayer);
  const lineAP = board.line(state.A, state.B, "midline extended", guidesLayer);
  const lineAQ = board.line(state.A, state.B, "midline extended", guidesLayer);
  const extAB = board.line(state.A, state.B, "extension", guidesLayer);
  const extAC = board.line(state.A, state.C, "extension", guidesLayer);
  const segmentPR = board.segment(state.A, state.B, "extension-seg", guidesLayer);
  const rightMarks = [
    board.rightAngle(state.A, state.B, state.C, 13, "right-mark", marksLayer),
    board.rightAngle(state.A, state.C, state.B, 13, "right-mark", marksLayer),
    board.rightAngle(state.A, state.B, state.C, 13, "right-mark", marksLayer),
    board.rightAngle(state.A, state.C, state.B, 13, "right-mark", marksLayer),
  ];
  const equalArcs = [
    board.angleArc(state.A, state.B, state.C, 21, "equal-arc", marksLayer),
    board.angleArc(state.A, state.C, state.B, 25, "equal-arc alt", marksLayer),
    board.angleArc(state.A, state.C, state.B, 17, "equal-arc", marksLayer),
  ];
  const chordHaQ = board.segment(state.A, state.B, "chord", guidesLayer);
  const dots = {
    P: board.point(state.A, "aux-dot", 4, marksLayer),
    Q: board.point(state.A, "aux-dot", 4, marksLayer),
    Ha: board.point(state.A, "alt-dot", 4.5, marksLayer),
    Ap: board.point(state.A, "mid-dot", 4.5, marksLayer),
    La: board.point(state.A, "aux-dot muted-dot", 3.5, marksLayer),
    R: board.point(state.A, "aux-dot", 4, marksLayer),
  };
  const labels = {
    A: board.label(state.A, "A", "glabel", -18, -10, labelsLayer),
    B: board.label(state.B, "B", "glabel", -18, 22, labelsLayer),
    C: board.label(state.C, "C", "glabel", 10, 22, labelsLayer),
    P: board.label(state.A, "P", "glabel aux-label", -18, -8, labelsLayer),
    Q: board.label(state.A, "Q", "glabel aux-label", 8, -8, labelsLayer),
    Ha: board.label(state.A, "Ha", "glabel aux-label", 8, 16, labelsLayer),
    Ap: board.label(state.A, "A'", "glabel aux-label", -20, 18, labelsLayer),
    La: board.label(state.A, "La", "glabel aux-label", -22, -8, labelsLayer),
    R: board.label(state.A, "R", "glabel aux-label", 8, 16, labelsLayer),
  };

  /**
   * Shows a line under the diagram. `kind` is "done" once the claim has been
   * checked; an illustration never uses "win" or "lose".
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const finite = (p) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y);
  const validCircle = (c) => finite(c && c.center) && Number.isFinite(c.radius);

  /* An object is only drawn when its geometry exists: a right triangle has no
   * circle on AC, and a nearly parallel intersection can go off to infinity. */
  function drawSeg(shape, a, b, on) {
    const ok = Boolean(on) && finite(a) && finite(b);
    shape.show(ok);
    if (ok) shape.set(a, b);
  }
  function drawCircle(shape, c, on) {
    const ok = Boolean(on) && validCircle(c);
    shape.show(ok);
    if (ok) shape.set(c.center, c.radius);
  }
  function drawDot(dot, p, on) {
    const ok = Boolean(on) && finite(p);
    dot.show(ok);
    if (ok) dot.set(p);
  }
  function drawLabel(label, p, on) {
    const ok = Boolean(on) && finite(p);
    label.show(ok);
    if (ok) label.set(p);
  }
  function drawMark(mark, vertex, a, b, size, on) {
    const ok = Boolean(on) && finite(vertex) && finite(a) && finite(b);
    mark.show(ok);
    if (ok) mark.set(vertex, a, b, size);
  }

  function render() {
    const options = Core.effectiveOptions(state.options);
    const figure = Core.construct(state);
    const showNames = options.names;

    optionInputs.forEach((input) => {
      if (input.dataset.option === "equalAngles") input.disabled = !Core.equalAnglesEnabled(state.options);
      input.checked = Boolean(state.options[input.dataset.option]);
    });

    sides.forEach((s, i) => {
      const pair = [[state.A, state.B], [state.B, state.C], [state.C, state.A]][i];
      drawSeg(s, pair[0], pair[1], true);
    });
    if (!figure) {
      [claimCircle, diameterCircle, altitude, bisector, perpB, perpC, legAP, legAQ,
        lineAP, lineAQ, extAB, extAC, segmentPR, chordHaQ].forEach((s) => s.show(false));
      Object.values(dots).forEach((d) => d.show(false));
      Object.values(labels).forEach((l) => l.show(false));
      rightMarks.forEach((m) => m.show(false));
      equalArcs.forEach((a) => a.show(false));
      say("Move the corners apart so the three points make a triangle.", null);
      if (window.Track) window.Track.state(state);
      return;
    }

    const { La, P, Q, Ha, Ap, R, circle, circleAC } = figure;
    drawCircle(claimCircle, circle, true);
    drawCircle(diameterCircle, circleAC, options.bigCircle);
    drawSeg(altitude, state.A, Ha, true);
    drawSeg(bisector, state.A, La, true);
    drawSeg(perpB, state.B, P, true);
    drawSeg(perpC, state.C, Q, true);

    drawSeg(legAP, Ap, P, !options.lines);
    drawSeg(legAQ, Ap, Q, !options.lines);
    drawSeg(lineAP, Ap, P, options.lines);
    drawSeg(lineAQ, Ap, Q, options.lines);
    drawSeg(extAB, state.A, state.B, options.lines);
    drawSeg(extAC, state.A, state.C, options.lines);
    drawSeg(segmentPR, P, R, options.lines);

    drawMark(rightMarks[0], Ha, state.B, state.A, 13, options.rightAngles);
    drawMark(rightMarks[1], Ha, state.C, state.A, 13, options.rightAngles);
    drawMark(rightMarks[2], P, state.B, state.A, 13, options.rightAngles);
    drawMark(rightMarks[3], Q, state.C, state.A, 13, options.rightAngles);

    drawMark(equalArcs[0], Ap, P, state.B, 21, options.equalAngles && options.lines);
    drawMark(equalArcs[1], state.A, state.C, state.B, 25,
      options.equalAngles && (options.lines || options.bigCircle));
    drawMark(equalArcs[2], Ha, Q, P, 17, options.equalAngles && options.bigCircle);
    drawSeg(chordHaQ, Ha, Q, options.equalAngles && options.bigCircle);

    const points = { P: P, Q: Q, Ha: Ha, Ap: Ap, La: La, R: R };
    Object.keys(points).forEach((key) =>
      drawDot(dots[key], points[key], key !== "R" || options.lines));
    drawLabel(labels.A, state.A, showNames);
    drawLabel(labels.B, state.B, showNames);
    drawLabel(labels.C, state.C, showNames);
    drawLabel(labels.P, P, showNames);
    drawLabel(labels.Q, Q, showNames);
    drawLabel(labels.Ha, Ha, showNames);
    drawLabel(labels.Ap, Ap, showNames);
    drawLabel(labels.La, La, showNames && finite(Ha) && finite(La) && Core.dist(Ha, La) > 10);
    drawLabel(labels.R, R, showNames && options.lines);

    const cl = Core.claims(state);
    if (cl && cl.concyclic) {
      say(checked
        ? "Checked: P, Q, A' and Ha lie on one circle in this triangle too."
        : "P, Q, A' and Ha lie on one circle. Drag a corner, or press Check the claim.",
        checked ? "done" : null);
    } else {
      say("Move the corners apart so the four points can be drawn.", null);
    }
    if (window.Track) window.Track.state(state);
  }

  function moveCorner(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const clampCorner = (p) => inside(p);
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const handleNames = ["A", "B", "C"];
  const handles = handleNames.map((name) => board.handle(name, state[name], {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampCorner,
    label: `Corner ${name}. Drag, or focus it and use the arrow keys to move it.`,
    describe: describe,
    onMove: (p) => moveCorner(name, p),
  }));

  function reset() {
    const options = Object.assign({}, state.options);
    state = Core.start();
    state.options = options;
    checked = false;
    handles.forEach((h, i) => h.set(state[handleNames[i]]));
    render();
    handles[0].node.focus();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", () => { checked = true; render(); });
  optionInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state = Core.withOption(state, input.dataset.option, input.checked);
      checked = false;
      render();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|BUTTON|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") { checked = true; render(); }
  });

  board.onTheme(render);
  render();
})();
