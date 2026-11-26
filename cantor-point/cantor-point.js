"use strict";

/*
 * The page for Cantor Point: drawing and input only; the mathematics is in
 * cantor-point-core.js. An SVG holds the triangle, its circumcircle, the
 * tangential triangle, the three Cantor lines and the nine-point circle. The
 * six tick boxes mirror the applet's six checkboxes; all start unticked there
 * and here. The three corners are draggable with a pointer or the arrow keys.
 */

(function () {
  const Core = CantorPointCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");

  const options = {
    circumcircle: false,
    circumcenter: false,
    circumradii: false,
    nine: false,
    cantor: false,
    tangential: false,
  };

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const finite = Core.finite;

  let state = Core.start();
  let checked = false;

  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every object is made once; only its geometry changes on a redraw. */
  const triangle = board.polygon([state.A, state.B, state.C], "tri-side", shapes);
  const circumcircle = board.circle(state.A, 1, "circumcircle", shapes);
  const circumdot = board.point(state.A, "circumdot", 4, marks);
  const radii = [
    board.line(state.A, state.A, "radius-line", shapes),
    board.line(state.A, state.A, "radius-line", shapes),
    board.line(state.A, state.A, "radius-line", shapes),
  ];
  const tangents = [
    board.line(state.A, state.A, "tangent-line", shapes),
    board.line(state.A, state.A, "tangent-line", shapes),
    board.line(state.A, state.A, "tangent-line", shapes),
  ];
  const tangentTri = board.polygon([state.A, state.B, state.C], "tangent-tri", shapes);
  const midDots = [
    board.point(state.A, "mid-dot", 3.5, marks),
    board.point(state.A, "mid-dot", 3.5, marks),
    board.point(state.A, "mid-dot", 3.5, marks),
  ];
  const cantorLines = [
    board.segment(state.A, state.A, "cantor-line", shapes),
    board.segment(state.A, state.A, "cantor-line", shapes),
    board.segment(state.A, state.A, "cantor-line", shapes),
  ];
  const footDots = [
    board.point(state.A, "foot-dot", 4, marks),
    board.point(state.A, "foot-dot", 4, marks),
    board.point(state.A, "foot-dot", 4, marks),
  ];
  const nineCircle = board.circle(state.A, 1, "nine-circle", marks);
  const cantorDot = board.point(state.A, "cantor-dot", 5, marks);
  const cantorLabel = board.label(state.A, "N", "glabel cantor-label", 9, -9, marks);
  const labels = [
    board.label(state.A, "A", "glabel", -20, 24, marks),
    board.label(state.B, "B", "glabel", -20, -10, marks),
    board.label(state.C, "C", "glabel", 10, 6, marks),
  ];

  /** Shows the status line. `kind` is "done" once the claims have been
   *  checked; that class is also how the player's record sees a finished
   *  exploration, so nothing else uses it. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const c = Core.construct(state);

    triangle.set([state.A, state.B, state.C]);
    labels[0].set(state.A);
    labels[1].set(state.B);
    labels[2].set(state.C);

    if (c.degenerate) {
      for (const s of [circumcircle, circumdot, tangentTri, nineCircle, cantorDot, cantorLabel]) s.show(false);
      for (const list of [radii, tangents, cantorLines, midDots, footDots]) {
        for (const s of list) s.show(false);
      }
      say("Move the corners apart so they make a triangle.", null);
      if (window.Track) window.Track.state(state);
      return;
    }

    const A = state.A, B = state.B, Cc = state.C;

    circumcircle.show(options.circumcircle && finite(c.O));
    if (options.circumcircle && finite(c.O)) circumcircle.set(c.O, c.R);
    circumdot.show(options.circumcenter && finite(c.O));
    if (options.circumcenter && finite(c.O)) circumdot.set(c.O);

    const vertices = [A, B, Cc];
    const tangentPoints = [c.tanA, c.tanB, c.tanC];
    for (let i = 0; i < 3; i++) {
      radii[i].show(options.circumradii && finite(c.O));
      if (options.circumradii && finite(c.O)) radii[i].set(c.O, vertices[i]);
      tangents[i].show(options.tangential);
      if (options.tangential) tangents[i].set(vertices[i], tangentPoints[i]);
    }
    const tangentialVertices = [c.tAB, c.tBC, c.tCA];
    const wholeTriangle = tangentialVertices.every(finite);
    tangentTri.show(options.tangential && wholeTriangle);
    if (options.tangential && wholeTriangle) tangentTri.set(tangentialVertices);

    const mids = [c.mA, c.mB, c.mC];
    const feet = [c.footA, c.footB, c.footC];
    for (let i = 0; i < 3; i++) {
      midDots[i].show(options.cantor);
      if (options.cantor) midDots[i].set(mids[i]);
      cantorLines[i].show(options.cantor && finite(feet[i]));
      if (options.cantor && finite(feet[i])) cantorLines[i].set(mids[i], feet[i]);
      footDots[i].show(options.cantor && finite(feet[i]));
      if (options.cantor && finite(feet[i])) footDots[i].set(feet[i]);
    }

    nineCircle.show(options.nine && finite(c.N));
    if (options.nine && finite(c.N)) nineCircle.set(c.N, c.r9);
    const markN = (options.cantor || options.nine) && finite(c.N);
    cantorDot.show(markN);
    cantorLabel.show(markN);
    if (markN) {
      cantorDot.set(c.N);
      cantorLabel.set(c.N);
    }

    if (checked && Core.claims(state).all) {
      say("The three Cantor lines meet at N, the centre of the nine-point circle.", "done");
    } else if (options.cantor || options.nine) {
      say("Drag A, B or C: the three Cantor lines still meet at N.", null);
    } else {
      say("Tick Cantor lines and Nine point circle to see the theorem. Drag a corner or use the arrow keys.", null);
    }
    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  function handle(name) {
    return board.handle(name, state[name], {
      r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move the triangle.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => moveVertex(name, p),
    });
  }
  const hA = handle("A"), hB = handle("B"), hC = handle("C");

  function newGame() {
    state = Core.start();
    checked = false;
    render();
    hA.node.focus();
  }

  function checkClaims() {
    checked = Core.claims(state).all;
    render();
    if (!checked) say("Make a triangle with three separate corners, then check again.", null);
  }

  function bindToggle(key, id) {
    const btn = document.getElementById(id);
    btn.setAttribute("aria-pressed", String(options[key]));
    btn.addEventListener("click", () => {
      options[key] = !options[key];
      btn.setAttribute("aria-pressed", String(options[key]));
      render();
    });
  }
  bindToggle("circumcircle", "circumcircleBtn");
  bindToggle("circumcenter", "circumcenterBtn");
  bindToggle("circumradii", "circumradiiBtn");
  bindToggle("nine", "nineBtn");
  bindToggle("cantor", "cantorBtn");
  bindToggle("tangential", "tangentialBtn");

  newBtn.addEventListener("click", newGame);
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
