"use strict";

/*
 * The page for BOL13: drawing and input only. The construction and the claim
 * live in bol-13-core.js.
 *
 * The SVG shows a circle, the horizontal diameter AB, a chord CD whose ends
 * slide around the circle, and the feet M and N of the perpendiculars from A
 * and B. Four draggable dots are focusable buttons: the centre O, a point Bo
 * that sets the radius, and C and D. The checkboxes reproduce the applet's
 * "Show names", "Show statement" and "Show hint" options; the applets' pink
 * segments become token-coloured highlights.
 */

(function () {
  const Core = Bol13Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const statementBtn = document.getElementById("statementBtn");
  const hintBtn = document.getElementById("hintBtn");

  let state = Core.start({});
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  /* Layers define paint order: the circle, the highlights, then the dots. */
  const guides = board.layer("guides");
  const highlights = board.layer("highlights");
  const aux = board.layer("aux");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const circle = board.circle(state.O, 100, "main-circle", guides);
  const diameter = board.segment(state.O, state.O, "diameter", guides);
  const chord = board.segment(state.C, state.D, "chord", guides);

  const highlightLines = [
    board.segment(state.D, state.O, "accent-seg", highlights),
    board.segment(state.C, state.O, "accent-seg", highlights),
    board.segment(state.C, state.O, "accent-seg", highlights),
    board.segment(state.D, state.O, "accent-seg", highlights),
    board.segment(state.O, state.O, "accent-seg", highlights),
  ];
  const perpendiculars = [
    board.segment(state.O, state.O, "perp-seg", aux),
    board.segment(state.O, state.O, "perp-seg", aux),
  ];
  const rightAngles = [
    board.rightAngle(state.O, state.O, state.O, 9, "right-angle", aux),
    board.rightAngle(state.O, state.O, state.O, 9, "right-angle", aux),
  ];
  const hintLines = [
    board.segment(state.O, state.O, "hint-seg", aux),
    board.segment(state.O, state.O, "hint-seg", aux),
    board.segment(state.O, state.O, "hint-seg", aux),
  ];

  const derivedDots = [
    board.point(state.O, "derived-dot", 4.5, marks), // E
    board.point(state.O, "foot-dot", 4.5, marks),    // M
    board.point(state.O, "foot-dot", 4.5, marks),    // N
    board.point(state.O, "hint-dot", 4, marks),      // H
    board.point(state.O, "hint-dot", 4, marks),      // K
  ];
  const endDots = [
    board.point(state.O, "end-dot", 4, marks),
    board.point(state.O, "end-dot", 4, marks),
  ];

  const pointLabels = [
    board.label(state.O, "A", "glabel", -17, 21, labelsLayer),
    board.label(state.O, "B", "glabel", 9, 21, labelsLayer),
    board.label(state.O, "C", "glabel", 9, -9, labelsLayer),
    board.label(state.O, "D", "glabel", -16, -9, labelsLayer),
    board.label(state.O, "O", "glabel", -16, -9, labelsLayer),
  ];
  const footLabels = [
    board.label(state.O, "M", "glabel", 8, -8, labelsLayer),
    board.label(state.O, "N", "glabel", 8, -8, labelsLayer),
  ];
  const hintLabels = [
    board.label(state.O, "E", "glabel", 8, -8, labelsLayer),
    board.label(state.O, "K", "glabel", 8, -8, labelsLayer),
    board.label(state.O, "H", "glabel", 8, -8, labelsLayer),
  ];

  const clampInside = (p) => Core.inside(p);
  const clampOnCircle = (name) => (p) => Core.withPoint(state, name, p)[name];

  const hO = board.handle("O", state.O, {
    r: 12, step: 4, shift: 12, layer: handlesLayer, clamp: clampInside,
    label: "Centre O. Drag it, or focus it and use the arrow keys to move the circle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("O", p),
  });
  const hBo = board.handle("Bo", state.Bo, {
    r: 12, step: 4, shift: 12, cls: "geom-handle radius-handle", layer: handlesLayer,
    clamp: clampInside,
    label: "Radius point. Drag it away from or towards O to change the circle's size.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("Bo", p),
  });
  const hC = board.handle("C", state.C, {
    r: 12, step: 4, shift: 12, layer: handlesLayer, clamp: clampOnCircle("C"),
    label: "Chord end C. Drag it around the circle, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("C", p),
  });
  const hD = board.handle("D", state.D, {
    r: 12, step: 4, shift: 12, layer: handlesLayer, clamp: clampOnCircle("D"),
    label: "Chord end D. Drag it around the circle, or use the arrow keys.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("D", p),
  });

  function syncHandles() {
    hO.set(state.O);
    hBo.set(state.Bo);
    hC.set(state.C);
    hD.set(state.D);
  }

  /**
   * Shows a line under the picture. "done" means the claim has been revealed;
   * there is no win or loss in an illustration. The class is also how the
   * player's record sees that the page has been explored.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measure(state);
    circle.set(m.O, m.r);
    diameter.set(m.A, m.B);
    chord.set(m.C, m.D);

    const visible = m.active;
    const [dmLine, cnLine, ceLine, deLine, oeLine] = highlightLines;
    const pairs = [
      [m.D, m.M], [m.C, m.N], [m.C, m.E], [m.D, m.E], [m.O, m.E],
    ];
    for (let i = 0; i < highlightLines.length; i++) {
      highlightLines[i].show(visible);
      if (visible && pairs[i][0] && pairs[i][1]) highlightLines[i].set(pairs[i][0], pairs[i][1]);
    }
    for (let i = 0; i < perpendiculars.length; i++) {
      perpendiculars[i].show(visible);
      if (visible) perpendiculars[i].set(i === 0 ? m.A : m.B, i === 0 ? m.M : m.N);
    }
    for (let i = 0; i < rightAngles.length; i++) {
      rightAngles[i].show(visible);
      if (visible) rightAngles[i].set(i === 0 ? m.M : m.N, i === 0 ? m.A : m.B, m.C, 9);
    }
    const hintPairs = [[m.M, m.B], [m.H, m.K], [m.O, m.K]];
    for (let i = 0; i < hintLines.length; i++) {
      hintLines[i].show(visible && state.showHint);
      if (visible && state.showHint) hintLines[i].set(hintPairs[i][0], hintPairs[i][1]);
    }

    const [eDot, mDot, nDot, hDot, kDot] = derivedDots;
    eDot.show(visible);
    mDot.show(visible);
    nDot.show(visible);
    hDot.show(visible && state.showHint);
    kDot.show(visible && state.showHint);
    if (visible) {
      eDot.set(m.E); mDot.set(m.M); nDot.set(m.N);
      if (state.showHint) { hDot.set(m.H); kDot.set(m.K); }
    }
    endDots[0].set(m.A);
    endDots[1].set(m.B);

    const named = [
      [m.A, -17, 21], [m.B, 9, 21], [m.C, 9, -9], [m.D, -16, -9], [m.O, -16, -9],
    ];
    for (let i = 0; i < pointLabels.length; i++) {
      pointLabels[i].show(state.showNames);
      pointLabels[i].set(named[i][0], undefined, named[i][1], named[i][2]);
    }
    const feet = [m.M, m.N];
    for (let i = 0; i < footLabels.length; i++) {
      footLabels[i].show(state.showNames && visible);
      if (visible) footLabels[i].set(feet[i]);
    }
    const hints = [m.E, m.K, m.H];
    for (let i = 0; i < hintLabels.length; i++) {
      hintLabels[i].show(state.showNames && visible && state.showHint);
      if (visible && state.showHint) hintLabels[i].set(hints[i]);
    }

    if (!visible) {
      say("That chord runs through the centre, so the construction is hidden. Move C or D away from the diameter.", null);
    } else if (state.showStatement) {
      say(`CN = ${fmt(m.cn)} and DM = ${fmt(m.dm)} — equal, as Archimedes said.`, "done");
    } else if (state.showHint) {
      say("H is midway between C and D and also between M and N, so CN = DM.", null);
    } else {
      say(`Drag C or D around the circle: CN = ${fmt(m.cn)} and DM = ${fmt(m.dm)}.`, null);
    }
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    let next = Core.withPoint(state, name, p);
    if (name === "O" || name === "Bo") next = Core.reproject(next);
    if (next === state) return;
    state = next;
    syncHandles();
    render();
  }

  function setOption(name, on) {
    state = Core.withPoint(state, name, on);
    updateButtons();
    render();
  }

  function updateButtons() {
    const labels = [
      [namesBtn, "showNames", "Hide names", "Show names"],
      [statementBtn, "showStatement", "Hide the claim", "Show the claim"],
      [hintBtn, "showHint", "Hide the hint", "Show the hint"],
    ];
    for (const [btn, key, onText, offText] of labels) {
      const on = state[key];
      btn.setAttribute("aria-pressed", String(on));
      btn.textContent = on ? onText : offText;
    }
  }

  function reset() {
    state = Core.start({ showNames: state.showNames, showStatement: state.showStatement, showHint: state.showHint });
    syncHandles();
    updateButtons();
    render();
    hO.node.focus();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => setOption("showNames", !state.showNames));
  statementBtn.addEventListener("click", () => setOption("showStatement", !state.showStatement));
  hintBtn.addEventListener("click", () => setOption("showHint", !state.showHint));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") reset();
    else if (e.key === "n" || e.key === "N") setOption("showNames", !state.showNames);
    else if (e.key === "s" || e.key === "S") setOption("showStatement", !state.showStatement);
    else if (e.key === "h" || e.key === "H") setOption("showHint", !state.showHint);
  });

  board.onTheme(render);
  updateButtons();
  render();
})();
