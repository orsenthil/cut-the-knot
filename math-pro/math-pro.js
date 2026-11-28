"use strict";

/*
 * UI for Math Pro: drawing and input only; the geometry lives in
 * math-pro-core.js. An SVG holds a draggable triangle ABC and a draggable
 * point P. The circle, the touch points D/E/F and the crossings X/Y/Z are
 * redrawn from the core on every move; Q is where DX and EY cross, and the
 * third cevian FZ passes through it. The four buttons mirror the applet's
 * one checkbox and add a view of the far crossings described on the page.
 */

(function () {
  const Core = MathProCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const namesBtn = document.getElementById("namesBtn");
  const farBtn = document.getElementById("farBtn");
  const checkBtn = document.getElementById("checkBtn");

  let state = Core.start();
  let showNames = true;
  let showFar = false;
  let checked = false;

  /* Painted back to front: circle and triangle, cevians, points, labels. */
  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const triangle = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const incircle = board.circle(state.A, 1, "incircle", shapes);
  const spokes = [
    board.segment(state.A, state.P, "spoke", guides),
    board.segment(state.B, state.P, "spoke", guides),
    board.segment(state.C, state.P, "spoke", guides),
  ];
  const cevians = [
    board.segment(state.A, state.B, "cevian", guides),
    board.segment(state.B, state.C, "cevian", guides),
    board.segment(state.C, state.A, "cevian", guides),
  ];
  const farLines = [
    board.segment(state.A, state.B, "far-line", guides),
    board.segment(state.B, state.C, "far-line", guides),
    board.segment(state.C, state.A, "far-line", guides),
  ];

  const touchDots = [
    board.point(state.A, "touch-dot", 4, marks),
    board.point(state.A, "touch-dot", 4, marks),
    board.point(state.A, "touch-dot", 4, marks),
  ];
  const crossDots = [
    board.point(state.A, "cross-dot", 4, marks),
    board.point(state.A, "cross-dot", 4, marks),
    board.point(state.A, "cross-dot", 4, marks),
  ];
  const farDots = [
    board.point(state.A, "far-dot", 4, marks),
    board.point(state.A, "far-dot", 4, marks),
    board.point(state.A, "far-dot", 4, marks),
  ];
  const qDot = board.point(state.A, "q-dot", 5.5, marks);

  const vertexLabels = [
    board.label(state.A, "A", "glabel", -17, -9, labelsLayer),
    board.label(state.B, "B", "glabel", -17, 20, labelsLayer),
    board.label(state.C, "C", "glabel", 8, 20, labelsLayer),
    board.label(state.P, "P", "glabel plabel", 8, -9, labelsLayer),
  ];
  const touchLabels = ["D", "E", "F"].map((text) =>
    board.label(state.A, text, "glabel small-label", 7, -7, labelsLayer));
  const crossLabels = ["X", "Y", "Z"].map((text) =>
    board.label(state.A, text, "glabel cross-label", 7, -7, labelsLayer));
  const farLabels = ["X′", "Y′", "Z′"].map((text) =>
    board.label(state.A, text, "glabel far-label", 7, -7, labelsLayer));
  const qLabel = board.label(state.A, "Q", "glabel q-label", 8, -9, labelsLayer);

  /** The status line doubles as the finished signal for a demo (class "done").
   *  It never reports a win or a loss: there is nothing to win here. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(0) : "—");

  function render() {
    const d = Core.diagram(state);
    triangle[0].set(state.A, state.B);
    triangle[1].set(state.B, state.C);
    triangle[2].set(state.C, state.A);
    for (let i = 0; i < 3; i++) spokes[i].set([state.A, state.B, state.C][i], state.P);
    vertexLabels[0].set(state.A);
    vertexLabels[1].set(state.B);
    vertexLabels[2].set(state.C);
    vertexLabels[3].set(state.P);
    for (const label of vertexLabels) label.show(showNames);

    const live = d.valid;
    incircle.show(live);
    qDot.show(false);
    qLabel.show(false);
    for (let i = 0; i < 3; i++) {
      cevians[i].show(false);
      farLines[i].show(false);
      touchDots[i].show(false);
      crossDots[i].show(false);
      farDots[i].show(false);
      touchLabels[i].show(false);
      crossLabels[i].show(false);
      farLabels[i].show(false);
    }

    if (!live) {
      const collapsed = Core.isDegenerate(state);
      say(collapsed
        ? "Move the corners apart to make a triangle."
        : "One of the lines from a corner misses the circle. Drag P towards the triangle.", null);
    } else {
      incircle.set(d.circle.center, d.circle.radius);
      const touches = [d.D, d.E, d.F];
      const crossings = [d.X, d.Y, d.Z];
      const far = [d.Xp, d.Yp, d.Zp];
      const starts = [d.D, d.E, d.F];
      for (let i = 0; i < 3; i++) {
        cevians[i].set(starts[i], crossings[i]);
        cevians[i].show(true);
        touchDots[i].set(touches[i]);
        touchDots[i].show(showNames);
        crossDots[i].set(crossings[i]);
        crossDots[i].show(showNames);
        touchLabels[i].set(touches[i]);
        touchLabels[i].show(showNames);
        crossLabels[i].set(crossings[i]);
        crossLabels[i].show(showNames);
        farLines[i].set(starts[i], far[i]);
        farLines[i].show(showFar);
        farDots[i].set(far[i]);
        farDots[i].show(showFar && showNames);
        farLabels[i].set(far[i]);
        farLabels[i].show(showFar && showNames);
      }
      qDot.show(Boolean(d.Q));
      qLabel.show(Boolean(d.Q) && showNames);
      if (d.Q) {
        qDot.set(d.Q);
        qLabel.set(d.Q);
      }

      const main = Core.concurrency(state, [false, false, false]);
      const allFar = Core.concurrency(state, [true, true, true]);
      if (checked && main.valid && main.concurrent) {
        let message = "DX, EY and FZ meet at Q. That is Rabinowitz's point.";
        if (showFar) {
          message += allFar.valid && !allFar.concurrent
            ? " The three far-point lines miss one another."
            : " Here even the three far-point lines meet — a touch point makes that exception.";
        }
        say(message, "done");
      } else if (showFar) {
        say(allFar.valid && !allFar.concurrent
          ? `DX, EY and FZ meet at Q. The far-point lines miss one another (closest ${fmt(allFar.error)}).`
          : "DX, EY and FZ meet at Q. A line is tangent here, so the far-point lines meet too.", null);
      } else {
        say(`DX, EY and FZ meet at Q = (${fmt(main.Q && main.Q.x)}, ${fmt(main.Q && main.Q.y)}). Press Check the lines.`, null);
      }
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const inside = (p) => ({
    x: Geom.clamp(p.x, 18, board.viewBox.x + board.viewBox.width - 18),
    y: Geom.clamp(p.y, 18, board.viewBox.y + board.viewBox.height - 18),
  });
  const handleOpts = (name, letter) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: `Point ${letter}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  });
  const hA = board.handle("A", state.A, { ...handleOpts("A", "A"), onMove: (p) => movePoint("A", p) });
  const hB = board.handle("B", state.B, { ...handleOpts("B", "B"), onMove: (p) => movePoint("B", p) });
  const hC = board.handle("C", state.C, { ...handleOpts("C", "C"), onMove: (p) => movePoint("C", p) });
  const hP = board.handle("P", state.P, { ...handleOpts("P", "P"), onMove: (p) => movePoint("P", p) });

  function setHandles() {
    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);
    hP.set(state.P);
  }

  function toggle(button, get, set, onText, offText) {
    set(!get());
    button.setAttribute("aria-pressed", String(get()));
    button.textContent = get() ? offText : onText;
    render();
  }

  function reset() {
    state = Core.start();
    checked = false;
    showFar = false;
    farBtn.setAttribute("aria-pressed", "false");
    farBtn.textContent = "Show far points";
    setHandles();
    render();
    hA.node.focus();
  }

  function checkLines() {
    checked = true;
    render();
    if (!Core.diagram(state).valid) say("Move the corners apart, then check again.", null);
  }

  resetBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, () => showNames, (v) => { showNames = v; }, "Show names", "Hide names"));
  farBtn.addEventListener("click", () =>
    toggle(farBtn, () => showFar, (v) => { showFar = v; }, "Show far points", "Hide far points"));
  checkBtn.addEventListener("click", checkLines);

  document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "n") namesBtn.click();
    else if (k === "f") farBtn.click();
    else if (k === "c") checkLines();
  });

  board.onTheme(render);
  setHandles();
  render();
})();
