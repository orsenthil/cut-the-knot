"use strict";

/*
 * Angle Bisector In Rectangle: drawing and input only. The geometry and the
 * claims live in angle-bisector-in-rectangle-core.js.
 *
 * The SVG holds the rectangle ABCD, its midpoints M and N, the point P on the
 * right side CD, and Q = AC ∩ MP. Four corner handles keep the rectangle
 * axis-aligned; the P handle slides along CD. The thick blue rays from N show
 * the two angles the page compares, and the green segment MN is their would-be
 * bisector. The status line reports their measured sizes.
 */

(function () {
  const Core = AngleBisectorInRectangleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inset = 12;
  const minSide = 60;
  const fmt = (rad) => (Number.isFinite(rad) ? (rad * 180 / Math.PI).toFixed(1) : "—");

  let state = Core.start({ width: 400, height: 300 });
  let showNames = false;
  let showStatement = false;
  let showHint = false;
  let verified = false;

  const shapes = board.layer("shapes");
  const rays = board.layer("rays");
  const marks = board.layer("marks");
  const guides = board.layer("guides");
  const handlesLayer = board.layer("handles");

  /* The elements are made once; every redraw only changes their geometry. */
  const rect = board.polygon([state.A, state.B, state.C, state.D], "rect-side", shapes);
  const cdLine = board.segment(state.P, state.C, "cd-line", shapes);
  const diagonal = board.segment(state.A, state.C, "diagonal", shapes);
  const mpLine = board.line(state.M || state.A, state.P, "mp-line", shapes);
  const mnLine = board.segment(state.A, state.C, "mn-line", rays);
  const rayNP = board.segment(state.A, state.B, "angle-ray angle-np", rays);
  const rayNQ = board.segment(state.A, state.B, "angle-ray angle-nq", rays);

  const dotM = board.point(state.A, "aux-dot", 4, marks);
  const dotN = board.point(state.B, "aux-dot", 4, marks);
  const dotO = board.point(state.A, "aux-dot", 4, marks);
  const dotQ = board.point(state.A, "aux-dot", 4, marks);
  const dotK = board.point(state.A, "hint-dot", 4, marks);
  const arcQNM = board.angleArc(state.B, state.C, state.D, 26, "half-arc", marks);
  const arcMNP = board.angleArc(state.B, state.C, state.D, 38, "half-arc other", marks);
  const okLine = board.segment(state.A, state.B, "hint-line", guides);
  const mkLine = board.segment(state.A, state.B, "hint-line", guides);

  const labelDefs = [
    ["A", state.A, -18, -8], ["B", state.B, -18, 20],
    ["C", state.C, 10, 20], ["D", state.D, 10, -8],
    ["M", state.A, -20, -8], ["N", state.B, -20, 20],
    ["O", state.A, 10, 4], ["P", state.P, 10, -8],
    ["Q", state.A, -20, 4], ["K", state.A, 8, -8],
  ];
  const labels = labelDefs.map(([text, p, dx, dy]) =>
    board.label(p, text, "glabel", dx, dy, marks));

  /**
   * The line under the picture. "done" is the only class an illustration ever
   * uses, and only after the player has pressed Check; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.construct(state);
    const m = Core.claims(state);
    const { A, B, C, D, P } = state;

    rect.set([A, B, C, D]);
    // The applet's DrawLine(g, P, C, D) draws the whole span of the three
    // collinear points, not an infinite line.
    cdLine.set(
      { x: C.x, y: Math.min(P.y, C.y, D.y) },
      { x: C.x, y: Math.max(P.y, C.y, D.y) },
    );
    diagonal.set(A, C);
    mpLine.set(g.M, P);
    mnLine.set(g.M, g.N);

    const haveQ = m.valid;
    const haveK = haveQ && Number.isFinite(g.K.x);
    rayNP.set(g.N, P);
    rayNQ.show(haveQ);
    if (haveQ) rayNQ.set(g.N, g.Q);

    dotM.set(g.M);
    dotN.set(g.N);
    dotO.set(g.O);
    dotQ.show(haveQ);
    if (haveQ) dotQ.set(g.Q);
    dotK.show(showHint && haveK);
    if (showHint && haveK) dotK.set(g.K);

    arcQNM.show(showStatement && haveQ);
    arcMNP.show(showStatement && haveQ);
    if (showStatement && haveQ) {
      arcQNM.set(g.N, g.Q, g.M, 26);
      arcMNP.set(g.N, g.M, P, 38);
    }
    okLine.show(showHint && haveK);
    mkLine.show(showHint && haveK);
    if (showHint && haveK) {
      okLine.set(g.O, g.K);
      mkLine.set(g.M, g.K);
    }

    const places = [A, B, C, D, g.M, g.N, g.O, P, g.Q, g.K];
    for (let i = 0; i < labels.length; i++) {
      labels[i].show(showNames && (i < 8 || (i === 8 && haveQ) || (i === 9 && showHint && haveK)));
      if (Number.isFinite(places[i].x)) labels[i].set(places[i]);
    }

    handles.A.set(A);
    handles.B.set(B);
    handles.C.set(C);
    handles.D.set(D);
    handles.P.set(P);

    if (!m.valid) {
      say("Move P away from the middle of CD, where the two lines stop meeting.", null);
    } else if (m.aboveO) {
      if (verified && m.anglesEqual) {
        say(`Checked: angle QNM = angle MNP = ${fmt(m.angleQNM)}°. MN bisects angle PNQ.`, "done");
      } else {
        say(`angle QNM = ${fmt(m.angleQNM)}°, angle MNP = ${fmt(m.angleMNP)}°. Drag a corner, or press Check the equality.`, null);
      }
    } else {
      say(`angle QNM + angle MNP = 180°: below the middle MN bisects the outside angle. Move P above the middle of CD for the page's equality.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampInside = (p) => ({
    x: Geom.clamp(p.x, view.x + inset, view.x + view.width - inset),
    y: Geom.clamp(p.y, view.y + inset, view.y + view.height - inset),
  });
  const describe = (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`;
  const cornerLabel = (name, whereText) =>
    `${name} (${whereText} corner). Drag, or focus and use the arrow keys to move it.`;

  const opt = (name, label, clamp, layer) => ({
    r: 9, step: 3, shift: 12, layer: layer || handlesLayer,
    label, describe,
    clamp,
    onMove: (p) => {
      state = Core.withPoint(state, name, p);
      verified = false;
      render();
    },
  });

  const handles = {
    A: board.handle("A", state.A, opt("A", cornerLabel("A", "top left"), (p) => {
      const q = clampInside(p);
      q.x = Math.min(q.x, state.D.x - minSide);
      q.y = Math.min(q.y, state.B.y - minSide);
      return q;
    })),
    B: board.handle("B", state.B, opt("B", cornerLabel("B", "bottom left"), (p) => {
      const q = clampInside(p);
      q.x = Math.min(q.x, state.C.x - minSide);
      q.y = Math.max(q.y, state.A.y + minSide);
      return q;
    })),
    C: board.handle("C", state.C, opt("C", cornerLabel("C", "bottom right"), (p) => {
      const q = clampInside(p);
      q.x = Math.max(q.x, state.B.x + minSide);
      q.y = Math.max(q.y, state.D.y + minSide);
      return q;
    })),
    D: board.handle("D", state.D, opt("D", cornerLabel("D", "top right"), (p) => {
      const q = clampInside(p);
      q.x = Math.max(q.x, state.B.x + minSide);
      q.y = Math.min(q.y, state.C.y - minSide);
      return q;
    })),
    P: board.handle("P", state.P, opt("P",
      "P on side CD. Drag up or down; use the arrow keys when focused. Its x stays with the right side.",
      (p) => {
        const q = clampInside(p);
        q.x = state.C.x;
        return q;
      })),
  };

  function reset() {
    state = Core.start({ width: 400, height: 300 });
    verified = false;
    render();
    handles.A.node.focus();
  }

  function check() {
    const m = Core.claims(state);
    verified = m.aboveO && m.anglesEqual;
    render();
    if (!verified && m.valid && !m.aboveO) say("Move P above the middle of CD, then check again.", null);
  }

  function toggle(btn, getValue, setValue, onText, offText) {
    const on = !getValue();
    setValue(on);
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? offText : onText;
    render();
  }

  newBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", check);
  namesBtn.addEventListener("click", () => toggle(namesBtn, () => showNames, (v) => { showNames = v; },
    "Show names", "Hide names"));
  statementBtn.addEventListener("click", () => toggle(statementBtn, () => showStatement, (v) => { showStatement = v; },
    "Show angle marks", "Hide angle marks"));
  hintBtn.addEventListener("click", () => toggle(hintBtn, () => showHint, (v) => { showHint = v; },
    "Show hint", "Hide hint"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") check();
  });

  board.onTheme(render);
  render();
})();
