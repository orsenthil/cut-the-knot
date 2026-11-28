"use strict";

/*
 * The page for McWorter: drawing and input only. The geometry is in
 * mcworter-core.js. An SVG shows the two squares on CA and CB, the triangle
 * ABC, the point D = A + B - C with the parallelogram ADBC, and the segment
 * A_b B_a with its midpoint M. Dragging A, B or C recomputes the diagram; the
 * buttons mirror the applet's names, rotation and hint checkboxes.
 */

(function () {
  const Core = McworterCore;
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

  /* McWorterCanvas.init on its preferred 400x250 canvas. The SVG's viewBox
   * starts at y=40 so that D, which init places below that canvas, is framed
   * as well; the point coordinates themselves are the applet's own. */
  let state = Core.start();
  const f0 = Core.figure(state); // starting geometry, for creating the SVG nodes
  let confirmed = false;

  const squareLayer = board.layer("squares");
  const lineLayer = board.layer("lines");
  const markLayer = board.layer("marks");
  const hintLayer = board.layer("hint");
  const handleLayer = board.layer("handles");

  /* Every object is created once; a redraw only changes its geometry, so a
     handle keeps its keyboard focus while the diagram moves under it. */
  const squares = [
    board.polygon([f0.B, f0.Ab, f0.Ac, f0.C], "flank-square", squareLayer),
    board.polygon([f0.C, f0.Bc, f0.Ba, f0.A], "flank-square alt", squareLayer),
  ];
  const triangle = [
    board.segment(state.A, state.B, "triangle-edge", squareLayer),
    board.segment(state.B, state.C, "triangle-edge", squareLayer),
    board.segment(state.C, state.A, "triangle-edge", squareLayer),
  ];
  const parallelogram = [
    board.segment(f0.D, f0.Ab, "para-edge", squareLayer),
    board.segment(f0.D, f0.Ba, "para-edge", squareLayer),
    board.segment(f0.D, f0.A, "para-edge alt", squareLayer),
    board.segment(f0.D, f0.B, "para-edge alt", squareLayer),
  ];
  const treasure = board.segment(state.A, state.B, "treasure-line", lineLayer);
  const proofLines = [
    board.segment(state.A, state.B, "proof-line", lineLayer),
    board.segment(state.A, state.B, "proof-line", lineLayer),
  ];
  const dDot = board.point(f0.D, "d-dot", 5, markLayer);
  const mDot = board.point(state.A, "mid-dot", 5, markLayer);
  const rightMark = board.rightAngle(f0.D, f0.Ba, f0.Ab, 11, "hint-right", hintLayer);
  const arcs = [
    board.angleArc(state.A, state.B, state.C, 15, "hint-arc", hintLayer),
    board.angleArc(state.B, state.A, state.C, 15, "hint-arc", hintLayer),
  ];
  /* LineID 2 marks AC, A B_a and BD twice; LineID 3 marks BC, B A_b, AD
     three times. These are the equal sides of the two congruent triangles. */
  const ticks = Array.from({ length: 15 }, () =>
    board.segment(state.A, state.B, "hint-tick", hintLayer));
  const labels = [
    board.label(state.A, "A", "glabel", -18, 22, markLayer),
    board.label(state.B, "B", "glabel", 8, 22, markLayer),
    board.label(state.C, "C", "glabel", 8, -10, markLayer),
    board.label(f0.D, "D", "glabel d-label", 8, -10, markLayer),
    board.label(state.A, "A_b", "glabel flank-label", 8, -8, markLayer),
    board.label(state.A, "A_c", "glabel flank-label", 8, -8, markLayer),
    board.label(state.A, "B_a", "glabel flank-label", -30, -8, markLayer),
    board.label(state.A, "B_c", "glabel flank-label", -30, -8, markLayer),
    board.label(state.A, "M", "glabel mid-label", 8, -10, markLayer),
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
   * Shows a line under the diagram. `kind` is "done" when the claims have
   * been checked; that is how the player's record sees that the illustration
   * has been explored. There is no win or loss here.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const f = Core.figure(state);

    squares[0].set([f.B, f.Ab, f.Ac, f.C]);
    squares[1].set([f.C, f.Bc, f.Ba, f.A]);
    triangle[0].set(f.A, f.B);
    triangle[1].set(f.B, f.C);
    triangle[2].set(f.C, f.A);
    parallelogram[0].set(f.D, f.Ab);
    parallelogram[1].set(f.D, f.Ba);
    parallelogram[2].set(f.D, f.A);
    parallelogram[3].set(f.D, f.B);
    dDot.set(f.D);

    /* DrawLines: A_b B_a in red, A M and B M, and a mark at M. */
    treasure.set(f.Ab, f.Ba);
    proofLines[0].set(f.A, f.M);
    proofLines[1].set(f.B, f.M);
    for (const line of proofLines) line.show(state.showLines);
    mDot.set(f.M);
    mDot.show(state.showLines);

    /* ShowHint: matching ticks and the right-angle corner at D. */
    setTicks(ticks, 0, state.A, state.C, 2);
    setTicks(ticks, 2, state.A, f.Ba, 2);
    setTicks(ticks, 4, state.B, f.D, 2);
    setTicks(ticks, 6, state.B, state.C, 3);
    setTicks(ticks, 9, state.B, f.Ab, 3);
    setTicks(ticks, 12, state.A, f.D, 3);
    for (const tick of ticks) tick.show(state.showHint);
    rightMark.set(f.D, f.Ba, f.Ab, 11);
    rightMark.show(state.showHint);
    arcs[0].set(state.A, state.B, state.C, 15);
    arcs[1].set(state.B, state.A, state.C, 15);
    for (const arc of arcs) arc.show(state.showHint);

    const words = ["A", "B", "C", "D", "A_b", "A_c", "B_a", "B_c", "M"];
    const spots = [f.A, f.B, f.C, f.D, f.Ab, f.Ac, f.Ba, f.Bc, f.M];
    for (let i = 0; i < labels.length; i++) {
      labels[i].set(spots[i], words[i]);
      labels[i].show(state.showNames && (i !== 8 || state.showLines));
    }

    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    linesBtn.setAttribute("aria-pressed", String(state.showLines));
    hintBtn.setAttribute("aria-pressed", String(state.showHint));

    const angle = Core.angleAtD(state);
    if (confirmed) {
      say("Checked: B_a D A_b is isosceles with a right angle at D, and M stays put.", "done");
    } else if (state.showHint) {
      say("The matching ticks show equal sides; the corner at D is a right angle.");
    } else if (Number.isFinite(angle)) {
      say(`D is at (${round(f.D.x)}, ${round(f.D.y)}). The angle at D is ${round(angle)} degrees.`);
    } else {
      say("The triangle at D has collapsed; move a point to open it up again.");
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
      label: "Point A. Drag, or focus it and use the arrow keys to move it",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: "Point B. Drag, or focus it and use the arrow keys to move it",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: "Point C. Drag, or focus it and use the arrow keys to move it",
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
      showNames: state.showNames, showLines: state.showLines, showHint: state.showHint,
    };
    state = Core.start(keep);
    confirmed = false;
    render();
    handles.C.node.focus();
  }

  function checkClaims() {
    const all = Core.claims(state);
    confirmed = Number.isFinite(Core.angleAtD(state)) && Object.values(all).every(Boolean);
    render();
    if (!confirmed) say("Move the points so the triangle at D has a real corner, then check again.");
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("showNames", namesBtn, "Hide names", "Show names"));
  linesBtn.addEventListener("click", () => toggle("showLines", linesBtn, "Hide rotation", "Show rotation"));
  hintBtn.addEventListener("click", () => toggle("showHint", hintBtn, "Hide hint", "Show hint"));
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggle("showNames", namesBtn, "Hide names", "Show names");
    if (key === "l") toggle("showLines", linesBtn, "Hide rotation", "Show rotation");
    if (key === "h") toggle("showHint", hintBtn, "Hide hint", "Show hint");
    if (key === "c") checkClaims();
  });

  board.onTheme(render);
  render();
})();
