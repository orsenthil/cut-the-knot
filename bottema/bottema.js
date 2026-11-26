"use strict";

/*
 * The page for Bottema: drawing and input only. The geometry is in
 * bottema-core.js. An SVG shows the two squares with common corner C, the
 * triangle ABC, the segment A_b B_a and its midpoint M. Dragging A, B or C
 * recomputes the diagram; "lines", "names" and "hint" mirror the applet's
 * three checkboxes, and the hint checkbox is greyed out until lines are shown.
 */

(function () {
  const Core = BottemaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const linesBtn = document.getElementById("linesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const round = (v) => Math.round(v * 10) / 10;

  let state = Core.start();
  let confirmed = false;

  const squareLayer = board.layer("squares");
  const lineLayer = board.layer("lines");
  const markLayer = board.layer("marks");
  const hintLayer = board.layer("hint");
  const handleLayer = board.layer("handles");

  /* Every object is made once and only its geometry changes on a redraw. */
  const squares = [
    board.polygon([state.B, state.A, state.C], "flank-square", squareLayer),
    board.polygon([state.C, state.A, state.B], "flank-square alt", squareLayer),
  ];
  const base = board.segment(state.A, state.B, "base-line", squareLayer);
  const treasure = board.segment(state.A, state.B, "treasure-line", lineLayer);
  const midDot = board.point(state.M || state.A, "mid-dot", 6, markLayer);
  const extraLines = [
    board.segment(state.A, state.B, "proof-line guide", lineLayer),
    board.segment(state.A, state.B, "proof-line", lineLayer),
    board.segment(state.A, state.B, "proof-line", lineLayer),
    board.segment(state.A, state.B, "proof-line", lineLayer),
    board.segment(state.A, state.B, "proof-line", lineLayer),
  ];
  const rightMarks = [
    board.rightAngle(state.A, state.B, state.C, 11, "hint-right", hintLayer),
    board.rightAngle(state.A, state.B, state.C, 11, "hint-right alt", hintLayer),
  ];
  /* One tick on MA and MB, two on M-A_c and M-B_c, three on M-A_b and M-B_a.
     The applet's LineID draws exactly these hatching patterns as its hint. */
  const ticks = Array.from({ length: 12 }, () =>
    board.segment(state.A, state.B, "hint-tick", hintLayer));
  const labels = [
    board.label(state.A, "A", "glabel", -18, 22, markLayer),
    board.label(state.B, "B", "glabel", 8, 22, markLayer),
    board.label(state.C, "C", "glabel", 8, -10, markLayer),
    board.label(state.A, "M", "glabel mid-label", 8, -10, markLayer),
    board.label(state.A, "A_b", "glabel flank-label", 8, -8, markLayer),
    board.label(state.A, "A_c", "glabel flank-label", 8, -8, markLayer),
    board.label(state.A, "B_a", "glabel flank-label", -30, -8, markLayer),
    board.label(state.A, "B_c", "glabel flank-label", -30, -8, markLayer),
  ];

  /** Position `count` short cross-strokes along the segment p--q. */
  function setTicks(from, index, p, q, count) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    for (let i = 0; i < count; i++) {
      const t = (i - (count - 1) / 2) * 5;
      const c = { x: mid.x + ux * t, y: mid.y + uy * t };
      from[index + i].set({ x: c.x - nx * 5, y: c.y - ny * 5 },
        { x: c.x + nx * 5, y: c.y + ny * 5 });
    }
  }

  /**
   * Shows the line under the diagram. "done" is how the player's record sees
   * that the illustration has been checked; it is not a win or a loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.figure(state);
    const showHint = state.showLines && state.showHint;
    const showExtra = state.showLines;

    squares[0].set([f.B, f.Ab, f.Ac, f.C]);
    squares[1].set([f.C, f.Bc, f.Ba, f.A]);
    base.set(f.A, f.B);
    treasure.set(f.Ab, f.Ba);
    midDot.set(f.M);

    /* DrawLines: B_c A_c in red, then A M, B M, A_c M and B_c M. */
    extraLines[0].set(f.Bc, f.Ac);
    extraLines[1].set(f.A, f.M);
    extraLines[2].set(f.B, f.M);
    extraLines[3].set(f.Ac, f.M);
    extraLines[4].set(f.Bc, f.M);
    for (const line of extraLines) line.show(showExtra);

    /* ShowHint: right-angle marks at M and tick marks on the six rays. */
    rightMarks[0].set(f.M, f.A, f.B, 11);
    rightMarks[1].set(f.M, f.Ac, f.Bc, 11);
    rightMarks[0].show(showHint);
    rightMarks[1].show(showHint);
    setTicks(ticks, 0, f.M, f.A, 1);
    setTicks(ticks, 1, f.M, f.B, 1);
    setTicks(ticks, 2, f.M, f.Ac, 2);
    setTicks(ticks, 4, f.M, f.Bc, 2);
    setTicks(ticks, 6, f.M, f.Ab, 3);
    setTicks(ticks, 9, f.M, f.Ba, 3);
    for (const tick of ticks) tick.show(showHint);

    const words = ["A", "B", "C", "M", "A_b", "A_c", "B_a", "B_c"];
    const spots = [f.A, f.B, f.C, f.M, f.Ab, f.Ac, f.Ba, f.Bc];
    for (let i = 0; i < labels.length; i++) {
      labels[i].set(spots[i], words[i]);
      labels[i].show(state.showNames);
    }

    hintBtn.disabled = !state.showLines;
    hintBtn.setAttribute("aria-pressed", String(state.showHint));
    linesBtn.setAttribute("aria-pressed", String(state.showLines));
    namesBtn.setAttribute("aria-pressed", String(state.showNames));

    if (confirmed) {
      say("Checked: M stays put when C moves, and AMB is an isosceles right triangle.", "done");
    } else if (showHint) {
      say("The right-angle marks and matching ticks show the two equal triangles at M.");
    } else {
      say(`M is at (${round(f.M.x)}, ${round(f.M.y)}). Drag C: M stays where it is.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, inside(p));
    confirmed = false;
    render();
  }

  const clampPoint = (p) => inside(p);
  const handles = {
    A: board.handle("A", state.A, {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: "Point A. Drag, or focus it and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: "Point B. Drag, or focus it and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: "Point C. Drag, or focus it and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint("C", p),
    }),
  };

  function toggle(name, btn, onText, offText) {
    state = Core.withOption(state, name, !state[name]);
    confirmed = false;
    btn.textContent = state[name] ? onText : offText;
    render();
  }

  function reset() {
    const keep = {
      showNames: state.showNames,
      showLines: state.showLines,
      showHint: state.showHint,
    };
    state = Core.start(keep);
    confirmed = false;
    render();
    handles.C.node.focus();
  }

  function checkClaims() {
    const all = Core.claims(state);
    confirmed = Core.distance(state.A, state.B) > 1 && Object.values(all).every(Boolean);
    render();
    if (!confirmed) say("Move the points apart, then check again.");
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("showNames", namesBtn, "Hide names", "Show names"));
  linesBtn.addEventListener("click", () => toggle("showLines", linesBtn, "Hide lines", "Show lines"));
  hintBtn.addEventListener("click", () => toggle("showHint", hintBtn, "Hide hint", "Show hint"));
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggle("showNames", namesBtn, "Hide names", "Show names");
    if (key === "l") toggle("showLines", linesBtn, "Hide lines", "Show lines");
    if (key === "h" && state.showLines) toggle("showHint", hintBtn, "Hide hint", "Show hint");
    if (key === "c") checkClaims();
  });

  board.onTheme(render);
  render();
})();
