"use strict";

/*
 * The page for Bisectal Circle: drawing and input only. The geometry lives in
 * bisectal-circle-core.js. An SVG holds two draggable circles (a centre dot and
 * a radius dot each), the bisectal circle (or its straight-line limit), a
 * draggable centre T for a circle orthogonal to it, and the two points where
 * that circle meets the given ones. The buttons mirror the applet's checkboxes:
 * names, hint, statement and the external/internal pair.
 */

(function () {
  const Core = BisectalCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const modeBtn = document.getElementById("modeBtn");
  const hintBtn = document.getElementById("hintBtn");
  const namesBtn = document.getElementById("namesBtn");
  const angleBtn = document.getElementById("angleBtn");
  const checkBtn = document.getElementById("checkBtn");
  const view = board.viewBox;

  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const clampRadius = (p, center) => {
    const q = inside(p);
    const dx = q.x - center.x, dy = q.y - center.y;
    const d = Math.hypot(dx, dy);
    if (d >= 12 && d <= 170) return q;
    const t = Geom.clamp(d || 12, 12, 170) / (d || 1);
    return { x: center.x + dx * t, y: center.y + dy * t };
  };
  const deg = (rad) => Number.isFinite(rad) ? (rad * 180 / Math.PI).toFixed(1) + "°" : "—";

  let state = Core.start();
  let mode = "external";
  let showHint = false;
  let showNames = true;
  let showAngles = false;
  let checked = false;

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every object is made once; a redraw only changes its geometry. */
  const given = [
    board.circle(state.O1, 1, "given-circle", shapes),
    board.circle(state.O2, 1, "given-circle", shapes),
  ];
  const radiusLines = [
    board.segment(state.O1, state.R1, "radius-line", guides),
    board.segment(state.O2, state.R2, "radius-line", guides),
  ];
  const tangents = [
    board.line(state.O1, state.O2, "tangent-line", guides),
    board.line(state.O2, state.O1, "tangent-line", guides),
  ];
  const bisectalCircle = board.circle(state.O1, 1, "bisectal", shapes);
  const bisectalLine = board.line(state.O1, state.O2, "bisectal-line", shapes);
  const testCircle = board.circle(state.T, 1, "test-circle", shapes);
  const centerDot = board.point(state.O1, "bisectal-center", 4.5, marks);
  const centerLabel = board.label(state.O1, "Q", "glabel center-label", 9, -9, marks);
  const crossDots = [
    board.point(state.O1, "cross-dot", 4, marks),
    board.point(state.O2, "cross-dot", 4, marks),
  ];
  const crossLabels = [
    board.label(state.O1, "S1", "glabel", 9, -9, marks),
    board.label(state.O2, "S2", "glabel", 9, -9, marks),
  ];
  const angleArcs = [
    board.angleArc(state.O1, state.O1, state.O2, 13, "angle-arc", marks),
    board.angleArc(state.O2, state.O1, state.O2, 13, "angle-arc", marks),
  ];
  const pointLabels = [
    board.label(state.O1, "O1", "glabel", -20, 22, marks),
    board.label(state.O2, "O2", "glabel", -20, 22, marks),
    board.label(state.T, "T", "glabel", 9, -9, marks),
  ];

  /**
   * Show the status line. `kind` is "done" once the diagram has been checked;
   * the shared record reads that class. An illustration never wins or loses.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const { c1, c2 } = Core.circles(state);
    const m = Core.measurements(state, mode);
    const bc = m.bisectal;
    const possible = m.possible;

    given[0].show(possible);
    given[1].show(possible);
    given[0].set(c1.center, c1.r);
    given[1].set(c2.center, c2.r);
    radiusLines[0].show(possible);
    radiusLines[1].show(possible);
    radiusLines[0].set(state.O1, state.R1);
    radiusLines[1].set(state.O2, state.R2);
    pointLabels[0].show(possible && showNames);
    pointLabels[1].show(possible && showNames);
    pointLabels[2].show(possible && showNames);
    if (possible) {
      pointLabels[0].set(state.O1);
      pointLabels[1].set(state.O2);
      pointLabels[2].set(state.T);
    }

    const lines = possible ? Core.tangentLines(state, mode) : [];
    for (let i = 0; i < 2; i++) {
      tangents[i].show(showHint && Boolean(lines[i]));
      if (lines[i]) tangents[i].set(lines[i][0], lines[i][1]);
    }

    const showBc = possible && Boolean(bc);
    const circleOn = showBc && !bc.infinite && bc.radius !== null;
    bisectalCircle.show(circleOn);
    if (circleOn) bisectalCircle.set(bc.center, bc.radius);
    bisectalLine.show(showBc && bc.infinite);
    if (bc && bc.infinite) bisectalLine.set(bc.line[0], bc.line[1]);

    const showCenter = showBc && !bc.infinite && Boolean(bc.center);
    centerDot.show(showCenter);
    centerLabel.show(showCenter && showNames);
    if (showCenter) centerDot.set(bc.center);
    if (showCenter) centerLabel.set(bc.center, mode === "internal" ? "P" : "Q");

    testCircle.show(Boolean(m.test));
    if (m.test) testCircle.set(m.test.center, m.test.r);

    const pair = m.pair;
    for (let i = 0; i < 2; i++) {
      crossDots[i].show(Boolean(pair));
      crossLabels[i].show(Boolean(pair) && showNames);
      angleArcs[i].show(Boolean(pair) && showAngles);
      if (pair) {
        crossDots[i].set(i === 0 ? pair.p : pair.q);
        crossLabels[i].set(i === 0 ? pair.p : pair.q);
        if (m.test) angleArcs[i].set(i === 0 ? pair.p : pair.q,
          i === 0 ? c1.center : c2.center, m.test.center, 13);
      }
    }

    if (!possible) {
      say("Move the circles apart so neither one sits inside the other.", null);
    } else if (bc.infinite) {
      say("The two circles have the same size, so the bisectal circle has stretched into a straight line. Drag a radius dot to bend it into a circle.", null);
    } else if (mode === "internal") {
      if (checked) {
        say("The other (internal) bisectal circle comes from a negative inversion power. Switch back to the external circle for the equal-angle test.", "done");
      } else {
        say("This is the other bisectal circle. Press Check the angles to see why it is different.", null);
      }
    } else if (!m.test) {
      say("Drag T outside the bisectal circle until its circle reaches the given circles, then press Check the angles.", null);
    } else if (!pair) {
      say("Move T so the test circle crosses both given circles, then press Check the angles.", null);
    } else if (checked) {
      say(`Both crossing angles are ${deg(m.angle1)}. The two circles are isogonal, so the test circle meets them at equal angles.`, "done");
    } else {
      say("The test circle is orthogonal to the bisectal circle. Press Check the angles to test what you see.", null);
    }

    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const hO1 = board.handle("O1", state.O1, {
    r: 8, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: "Centre O1. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("O1", p),
  });
  const hR1 = board.handle("R1", state.R1, {
    r: 7, step: 3, shift: 12, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: (p) => clampRadius(p, state.O1),
    label: "Radius dot R1. Drag, or focus and use the arrow keys to change the first circle's size.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("R1", p),
  });
  const hO2 = board.handle("O2", state.O2, {
    r: 8, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: "Centre O2. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("O2", p),
  });
  const hR2 = board.handle("R2", state.R2, {
    r: 7, step: 3, shift: 12, cls: "geom-handle aux-handle", layer: handlesLayer,
    clamp: (p) => clampRadius(p, state.O2),
    label: "Radius dot R2. Drag, or focus and use the arrow keys to change the second circle's size.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("R2", p),
  });
  const hT = board.handle("T", state.T, {
    r: 8, step: 3, shift: 12, cls: "geom-handle t-handle", layer: handlesLayer, clamp: inside,
    label: "Centre T of the test circle. Drag, or focus and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => movePoint("T", p),
  });

  function syncHandles() {
    hO1.set(state.O1);
    hR1.set(state.R1);
    hO2.set(state.O2);
    hR2.set(state.R2);
    hT.set(state.T);
  }

  function newGame() {
    state = Core.start();
    checked = false;
    syncHandles();
    render();
    hO1.node.focus();
  }

  function checkAngles() {
    const m = Core.measurements(state, mode);
    if (!m.possible || (m.bisectal && m.bisectal.infinite)) {
      say("Give the circles different sizes first: drag one of the radius dots.", null);
      return;
    }
    if (mode === "internal" || m.pair) {
      checked = true;
      render();
    } else {
      say("Move T until the test circle crosses both given circles, then check again.", null);
    }
  }

  newBtn.addEventListener("click", newGame);
  modeBtn.addEventListener("click", () => {
    mode = mode === "external" ? "internal" : "external";
    checked = false;
    modeBtn.setAttribute("aria-pressed", String(mode === "internal"));
    modeBtn.textContent = mode === "internal"
      ? "Show external bisectal circle" : "Show internal bisectal circle";
    render();
  });
  hintBtn.addEventListener("click", () => {
    showHint = !showHint;
    hintBtn.setAttribute("aria-pressed", String(showHint));
    hintBtn.textContent = showHint ? "Hide tangent lines" : "Show tangent lines";
    render();
  });
  namesBtn.addEventListener("click", () => {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  });
  angleBtn.addEventListener("click", () => {
    showAngles = !showAngles;
    angleBtn.setAttribute("aria-pressed", String(showAngles));
    angleBtn.textContent = showAngles ? "Hide angle marks" : "Show angle marks";
    render();
  });
  checkBtn.addEventListener("click", checkAngles);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === "r") newGame();
    if (key === "e") modeBtn.click();
    if (key === "h") hintBtn.click();
    if (key === "n") namesBtn.click();
    if (key === "a") angleBtn.click();
    if (key === "c") checkAngles();
  });

  board.onTheme(render);
  render();
})();
