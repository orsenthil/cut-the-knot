"use strict";

/*
 * The Cross Circle page: drawing and input only; all geometry lives in
 * cross-circle-core.js. The SVG shows triangle ABC, the point P and its three
 * feet, the circle through those feet, the second crossing on each side line,
 * the perpendiculars there and the point S where they meet. Four handles are
 * draggable and keyboard-movable; Hint adds the circle's centre, the chord
 * midpoints and the line from P to S, as in the original applet.
 */

(function () {
  const Core = CrossCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const hintBtn = document.getElementById("hintBtn");
  const moveBtn = document.getElementById("moveBtn");
  const newBtn = document.getElementById("newBtn");
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();

  /* Paint order: construction first, labels next, draggable handles last. */
  const triangleLayer = board.layer("triangle");
  const circleLayer = board.layer("circle");
  const dropsLayer = board.layer("drops");
  const hintsLayer = board.layer("hints");
  const perpsLayer = board.layer("perps");
  const marksLayer = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const triangle = board.polygon([state.A, state.B, state.C], "tri-side", triangleLayer);
  const pedalCircle = board.circle(state.P, 1, "pedal-circle", circleLayer);
  const drops = [0, 1, 2].map(() => board.segment(state.P, state.A, "drop-line", dropsLayer));
  const rightMarks = [0, 1, 2].map(() =>
    board.rightAngle(state.A, state.B, state.C, 6, "right-mark", marksLayer));
  const spokes = [0, 1, 2].map(() => board.segment(state.P, state.A, "spoke", triangleLayer));
  const perps = [0, 1, 2].map(() => board.segment(state.A, state.B, "new-perp", perpsLayer));
  const footDots = [0, 1, 2].map(() => board.point(state.A, "foot-dot", 3.8, marksLayer));
  const secondDots = [0, 1, 2].map(() => board.point(state.A, "second-dot", 4.2, marksLayer));
  const meetDot = board.point(state.A, "meet-dot", 5, marksLayer);
  const hintLine = board.line(state.P, state.A, "hint-line", hintsLayer);
  const hintSpokes = [0, 1, 2].map(() =>
    board.segment(state.A, state.B, "hint-spoke", hintsLayer));
  const centerDot = board.point(state.A, "center-dot", 4, hintsLayer);

  const labels = [
    board.label(state.A, "A", "glabel", -17, -9, labelsLayer),
    board.label(state.B, "B", "glabel", -17, 18, labelsLayer),
    board.label(state.C, "C", "glabel", 9, 5, labelsLayer),
    board.label(state.P, "P", "glabel", 9, -9, labelsLayer),
    board.label(state.A, "S", "glabel label-s", 9, -9, labelsLayer),
    board.label(state.A, "O", "glabel label-o", 9, -9, labelsLayer),
  ];

  /**
   * A line under the picture. An illustration has no win or loss, so `kind`
   * stays empty here: the record follows the saved position instead.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const d = Core.compute(state);
    const A = state.A, B = state.B, C = state.C, P = state.P;
    const ends = [[B, C], [C, A], [A, B]];
    const good = Core.drawn(d);

    triangle.set([A, B, C]);
    for (let i = 0; i < 3; i++) {
      drops[i].set(P, d.feet[i]);
      rightMarks[i].set(d.feet[i], P, ends[i][0], 6);
      footDots[i].set(d.feet[i]);
    }
    rightMarks.forEach((m) => m.show(true));
    footDots.forEach((dot) => dot.show(true));

    pedalCircle.show(good && Number.isFinite(d.circle.r) && d.circle.r < 2000);
    if (good) pedalCircle.set(d.circle, d.circle.r);
    for (let i = 0; i < 3; i++) {
      perps[i].show(good);
      secondDots[i].show(good);
      spokes[i].show(good);
      if (good) {
        perps[i].set(d.others[i], d.ends[i]);
        secondDots[i].set(d.others[i]);
        spokes[i].set(d.reflected, d.others[i]);
      }
    }
    meetDot.show(good);
    if (good) meetDot.set(d.reflected);

    hintLine.show(good && state.hint);
    centerDot.show(good && state.hint);
    for (let i = 0; i < 3; i++) hintSpokes[i].show(good && state.hint);
    if (good && state.hint) {
      hintLine.set(P, d.reflected);
      centerDot.set(d.circle);
      for (let i = 0; i < 3; i++) hintSpokes[i].set(d.circle, d.projections[i]);
    }

    labels[0].set(A); labels[1].set(B); labels[2].set(C); labels[3].set(P);
    labels[4].set(d.reflected); labels[5].set(d.circle);
    labels[4].show(good);
    labels[5].show(good && state.hint);

    hA.set(A); hB.set(B); hC.set(C); hP.set(P);
    hintBtn.setAttribute("aria-pressed", String(state.hint));

    if (!good) {
      say("The three feet lie on one straight line, so there is no circle through them. Move P off the triangle's circumcircle.", null);
    } else {
      const gap = Core.reflectionError(d);
      const howNear = gap < 0.05 ? "to within a tenth of a pixel" : `about ${fmt(gap)} units apart`;
      let message = `The circle meets each side again. The new perpendiculars meet at S, opposite P across the circle's centre (${howNear}).`;
      if (state.hint) {
        message += " The centre is O; the faint lines go to the middles of the three chords.";
      }
      say(message, null);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state({ A: A, B: B, C: C, P: P, hint: state.hint });
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }

  const handleOptions = (name) => ({
    r: 9, step: 3, shift: 12, layer: handlesLayer,
    clamp: (p) => Core.inside(p),
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => move(name, p),
  });
  const hA = board.handle("A", state.A, handleOptions("A"));
  const hB = board.handle("B", state.B, handleOptions("B"));
  const hC = board.handle("C", state.C, handleOptions("C"));
  const hP = board.handle("P", state.P, handleOptions("P"));

  function toggleHint() {
    state = Core.withHint(state, !state.hint);
    render();
  }

  function moveP() {
    state = Core.randomP(state);
    render();
  }

  function reset() {
    state = Core.start({ hint: state.hint });
    render();
    hP.node.focus();
  }

  hintBtn.addEventListener("click", toggleHint);
  moveBtn.addEventListener("click", moveP);
  newBtn.addEventListener("click", reset);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
    if (e.key === "h" || e.key === "H") toggleHint();
    else if (e.key === "m" || e.key === "M") moveP();
    else if (e.key === "r" || e.key === "R") reset();
  });

  board.onTheme(render);
  render();
})();
