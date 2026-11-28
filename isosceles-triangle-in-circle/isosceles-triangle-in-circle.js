"use strict";

/*
 * The page for Isosceles Triangle In Circle: drawing and input only.
 * isosceles-triangle-in-circle-core.js holds the geometry. The SVG has three
 * draggable corners A, B, C; D, E, O and the line EO are rebuilt from the core
 * on every move. Show premise adds the circumcircle and midpoint marks, Show
 * hint adds the median, the right angles and the other named points. Nothing
 * here can be won or lost: Check the claim marks the illustration as explored.
 */

(function () {
  const Core = IsoscelesTriangleInCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const premiseBtn = document.getElementById("premiseBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  const fmt = (v) => (Math.round(v * 10) / 10).toFixed(1);

  let state = Core.start();
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Build each SVG object once; render() only updates its geometry. */
  const circumcircle = board.circle(state.A, 1, "circumcircle", guides);
  const median = board.segment(state.A, state.B, "median", shapes);
  const eoLine = board.line(state.A, state.B, "eo-line", shapes);
  const altitude = board.line(state.A, state.B, "altitude", shapes);
  const sides = [0, 1, 2].map(() => board.segment(state.A, state.B, "tri-side", shapes));
  const hintLines = [0, 1, 2].map(() => board.segment(state.A, state.B, "hint-line", shapes));
  const rightAngles = [0, 1, 2, 3, 4].map(() =>
    board.rightAngle(state.A, state.B, state.C, 9, "right-angle", marks));
  const ticks = [];
  for (let i = 0; i < 18; i++) ticks.push(board.segment(state.A, state.B, "tick", marks));
  const dots = {
    E: board.point(state.A, "def-dot", 4, marks),
    D: board.point(state.A, "def-dot", 4, marks),
    O: board.point(state.A, "center-dot", 5, marks),
    F: board.point(state.A, "aux-dot", 4, marks),
    Am: board.point(state.A, "aux-dot", 4, marks),
    S: board.point(state.A, "aux-dot", 3.5, marks),
    P: board.point(state.A, "aux-dot", 3.5, marks),
    M: board.point(state.A, "aux-dot", 3.5, marks),
  };
  const labelNames = ["A", "B", "C", "D", "E", "O", "F", "Am", "S", "P", "M"];
  const labels = {};
  for (const name of labelNames) {
    labels[name] = board.label(state.A, name, "glabel", 8, -8, labelsLayer);
  }

  /* The small strokes that mark equal lengths: one stroke on AD and DB,
     two on AF and FC, three on AmD and AmC. */
  function setTicks(index, count, p, q) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    const nx = -uy * 4, ny = ux * 4;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    for (let i = 0; i < 3; i++) {
      const t = i - (count - 1) / 2;
      const cx = mx + ux * t * 5, cy = my + uy * t * 5;
      const obj = ticks[index * 3 + i];
      obj.show(state.showPremise && i < count && len > 1);
      if (i < count) obj.set({ x: cx - nx, y: cy - ny }, { x: cx + nx, y: cy + ny });
    }
  }

  /**
   * Shows the line under the board. "done" marks an explored illustration;
   * there is no win or loss, so "win" and "lose" are never used here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    const cl = Core.claims(state);
    const { A, B, C: Cc, D, E, O, M, F, Am, S, P } = m;

    sides[0].set(A, B); sides[1].set(B, Cc); sides[2].set(Cc, A);
    median.set(Cc, D);

    const circleOk = finite(O) && m.circle && Number.isFinite(m.circle.radius);
    circumcircle.show(state.showPremise && circleOk);
    if (circleOk) circumcircle.set(O, m.circle.radius);

    const eoOk = finite(E) && finite(O) && Core.distance(E, O) > Core.EPS;
    eoLine.show(eoOk);
    if (eoOk) eoLine.set(E, O);

    /* Show hint: the median from A, the segment EP, DO and MO, and the
       right angles the page's first solution uses in triangle PDE. */
    const altitudeOk = finite(A) && finite(M);
    altitude.show(state.showHint && altitudeOk);
    if (altitudeOk) altitude.set(A, M);
    const hints = [[E, P], [D, O], [M, O]];
    for (let i = 0; i < 3; i++) {
      const [p, q] = hints[i];
      const ok = finite(p) && finite(q);
      hintLines[i].show(state.showHint && ok);
      if (ok) hintLines[i].set(p, q);
    }
    const rightTriples = [
      [F, O, Cc], [D, O, B], [M, O, B], [M, O, Cc], [M, A, B],
    ];
    for (let i = 0; i < rightTriples.length; i++) {
      const [v, p, q] = rightTriples[i];
      const ok = finite(v) && finite(p) && finite(q) &&
        (i < 4 || (state.showHint && Core.finished(state)));
      rightAngles[i].show(state.showHint && ok);
      if (ok) rightAngles[i].set(v, p, q, 9);
    }

    setTicks(0, 1, A, D); setTicks(1, 1, D, B);
    setTicks(2, 2, A, F); setTicks(3, 2, F, Cc);
    setTicks(4, 3, Am, D); setTicks(5, 3, Am, Cc);

    const visible = {
      E: true, D: true, O: finite(O),
      F: state.showPremise || state.showHint,
      Am: state.showPremise,
      S: state.showHint, P: state.showHint, M: state.showHint,
    };
    for (const name of Object.keys(dots)) {
      const ok = visible[name] && finite(m[name]);
      dots[name].show(ok);
      if (ok) dots[name].set(m[name]);
    }

    const place = {
      A: [-13, 21], B: [10, -8], C: [8, -8], D: [-20, -10], E: [9, -14],
      O: [8, 18], F: [8, -8], Am: [-22, 11], S: [-18, 9], P: [-10, -15], M: [10, 17],
    };
    for (const name of labelNames) {
      const ok = state.showNames && finite(m[name]) && visible[name];
      labels[name].show(ok);
      if (ok) labels[name].set(m[name], undefined, place[name][0], place[name][1]);
    }

    if (cl.collinear) {
      say("A, B and C are in one line, so there is no circumcircle O. Drag a corner off the line.");
    } else if (checked && cl.perpendicular) {
      say(`Checked: AB = AC = ${fmt(m.AB)} and EO is perpendicular to CD — the dot product is zero.`, "done");
    } else if (checked) {
      say(`Checked: AB is ${fmt(m.AB)} and AC is ${fmt(m.AC)}, so EO is not perpendicular to CD. Put A on the perpendicular bisector of BC.`, "done");
    } else if (Core.finished(state)) {
      say("AB and AC are now within one pixel: EO and CD meet at a right angle.");
    } else {
      say(`AB is ${fmt(m.AB)} and AC is ${fmt(m.AC)}. Drag A, B or C; press Check the claim when they match.`);
    }
    if (window.Track) window.Track.state(state);
  }

  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  function movePoint(p, name) {
    const next = Core.withPoint(state, name, inside(p));
    if (next === state) return;
    state = next;
    checked = false;
    hA.set(state.A); hB.set(state.B); hC.set(state.C);
    render();
  }
  const handleOpts = (label) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label, describe, onMove: movePoint,
  });
  const hA = board.handle("A", state.A, handleOpts("Corner A. Drag, or focus and use the arrow keys to move it"));
  const hB = board.handle("B", state.B, handleOpts("Corner B. Drag, or focus and use the arrow keys to move it"));
  const hC = board.handle("C", state.C, handleOpts("Corner C. Drag, or focus and use the arrow keys to move it"));

  function reset() {
    /* Keep the three overlays as the player left them; only the triangle
       returns to its opening shape, so the buttons stay truthful. */
    state = Core.start({
      showNames: state.showNames,
      showPremise: state.showPremise,
      showHint: state.showHint,
    });
    checked = false;
    hA.set(state.A); hB.set(state.B); hC.set(state.C);
    render();
    hA.node.focus();
  }

  function checkClaim() {
    checked = true;
    render();
  }

  function toggle(btn, key, label) {
    state = Core.withOption(state, key, !state[key]);
    btn.setAttribute("aria-pressed", String(state[key]));
    btn.textContent = (state[key] ? "Hide " : "Show ") + label;
    render();
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  namesBtn.addEventListener("click", () => toggle(namesBtn, "showNames", "names"));
  premiseBtn.addEventListener("click", () => toggle(premiseBtn, "showPremise", "premise"));
  hintBtn.addEventListener("click", () => toggle(hintBtn, "showHint", "hint"));
  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    else if (key === "c") checkClaim();
    else if (key === "n") namesBtn.click();
    else if (key === "p") premiseBtn.click();
    else if (key === "h") hintBtn.click();
  });

  board.onTheme(render);
  render();
})();
