"use strict";

/*
 * The page for Circle On Cevian: drawing and input only; the mathematics is in
 * circle-on-cevian-core.js. An SVG holds a triangle, the cevians from its three
 * corners, a circle on each cevian as diameter, the altitude feet where those
 * circles cut the opposite sides, and the radical axes that all pass through the
 * orthocenter. Six dots can be dragged: the corners and the feet of the cevians.
 */

(function () {
  const Core = CircleOnCevianCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const nBtns = [
    document.getElementById("oneBtn"),
    document.getElementById("twoBtn"),
    document.getElementById("threeBtn"),
  ];
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start();

  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const hints = board.layer("hints");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* The applet adds the circles in the order C, A, B as N grows. */
  const order = [2, 0, 1];
  const names = ["A", "B", "C"];
  const subs = ["a", "b", "c"];

  const sides = [0, 1, 2].map((i) =>
    board.segment(state.A[i], state.A[(i + 1) % 3], "tri-side", shapes));
  const cevians = [0, 1, 2].map((i) =>
    board.segment(state.A[i], state.P[i], "cevian", shapes));
  const circles = [0, 1, 2].map((i) =>
    board.circle(state.A[i], 1, "cevian-circle cevian-" + subs[i], shapes));
  const altitudes = [0, 1, 2].map((i) =>
    board.line(state.A[i], state.P[i], "altitude", guides));
  const rightAngles = [0, 1, 2].map((i) =>
    board.rightAngle(state.P[i], state.A[i], state.P[i], 7, "right-angle", marks));
  const proofLines = [0, 1, 2].map((i) =>
    [0, 1].map(() => board.segment(state.A[i], state.P[i], "proof-line", hints)));
  const proofLegs = [0, 1, 2].map((i) =>
    [0, 1].map(() => board.segment(state.A[i], state.P[i], "proof-line", hints)));

  const pairs = [[2, 0], [0, 1], [1, 2]];
  const axes = pairs.map(() => board.line(state.A[0], state.A[1], "radical-axis", shapes));
  const hits = pairs.map(() => [0, 1].map(() => board.point(state.A[0], "cross-dot", 3, marks)));

  const centers = [0, 1, 2].map((i) => board.point(state.A[i], "center-dot", 3, marks));
  const feet = [0, 1, 2].map((i) => board.point(state.P[i], "foot-dot", 4, marks));
  const vertexLabels = [0, 1, 2].map((i) =>
    board.label(state.A[i], names[i], "glabel", -18, 22, marks));
  const footLabels = [0, 1, 2].map((i) =>
    board.label(state.P[i], "P" + subs[i], "glabel p-label", 7, -9, marks));
  const centerLabels = [0, 1, 2].map((i) =>
    board.label(state.A[i], "O" + subs[i], "glabel o-label", 7, 15, marks));
  const footNameLabels = [0, 1, 2].map((i) =>
    board.label(state.P[i], "H" + subs[i], "glabel h-label", 7, -9, marks));
  const orthoDot = board.point(state.A[0], "ortho-dot", 5.5, marks);
  const orthoLabel = board.label(state.A[0], "H", "glabel h-label", 8, -8, marks);

  /* ShowAngle arcs from the applet's Draw, in the same order and style. */
  const arcSpecs = [
    ["F2", "A0", "A2", 1], ["F2", "A1", "A2", 1],
    ["F0", "A0", "A2", 1], ["F0", "A0", "A1", 1],
    ["A1", "A0", "A2", 2], ["HH", "A0", "F2", 2], ["HH", "A2", "F0", 2],
    ["A2", "A1", "F2", 3], ["A0", "A1", "F0", 3],
  ];
  const arcs = arcSpecs.map(([, , , style]) =>
    board.angleArc(state.A[0], state.A[1], state.A[2], style === 1 ? 14 : style === 2 ? 11 : 9,
      "hint-arc arc-" + style, hints));

  /**
   * Shows a line under the picture. `kind` is only used to mark a finished
   * play ("done"); an illustration has no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const A = state.A, P = state.P;
    const active = order.slice(0, state.N);
    hintBtn.disabled = state.N === 3; // the applet switches Hint off with three cevians

    for (let i = 0; i < 3; i++) sides[i].set(A[i], A[(i + 1) % 3]);

    for (let i = 0; i < 3; i++) {
      const on = active.includes(i);
      const [j, k] = Core.other(i);
      const z = m.circles[i], f = m.feet[i];
      cevians[i].show(on).set(A[i], P[i]);
      circles[i].show(on).set(z.c, z.r);
      centers[i].show(on).set(z.c);
      feet[i].show(on).set(f);
      altitudes[i].show(on).set(A[i], f);
      rightAngles[i].show(on && !m.degenerate).set(f, A[i], P[i], 7);
      vertexLabels[i].show(state.showNames).set(A[i]);
      footLabels[i].show(on).set(P[i]);
      centerLabels[i].show(on).set(z.c);
      footNameLabels[i].show(on && state.showNames).set(f);
      proofLines[i][0].show(on && state.showHint).set(f, A[j]);
      proofLines[i][1].show(on && state.showHint).set(f, A[k]);
      proofLegs[i][0].show(on && state.showHint).set(P[i], A[j]);
      proofLegs[i][1].show(on && state.showHint).set(P[i], A[k]);
    }

    for (let p = 0; p < m.pairs.length; p++) {
      const { axis, hits: pts } = m.pairs[p];
      const on = Boolean(axis) && !m.degenerate;
      axes[p].show(on);
      if (on) {
        const t = 500;
        axes[p].set(
          { x: axis.point.x - axis.dir.x * t, y: axis.point.y - axis.dir.y * t },
          { x: axis.point.x + axis.dir.x * t, y: axis.point.y + axis.dir.y * t },
        );
      }
      hits[p][0].show(on && pts.length > 0);
      hits[p][1].show(on && pts.length > 1);
      if (pts.length > 0) hits[p][0].set(pts[0]);
      if (pts.length > 1) hits[p][1].set(pts[1]);
    }

    const showH = Boolean(m.orthocenter) && state.N > 1 && !m.degenerate;
    orthoDot.show(showH);
    orthoLabel.show(showH && state.showNames);
    if (showH) {
      orthoDot.set(m.orthocenter);
      orthoLabel.set(m.orthocenter);
    }

    const at = (token) => {
      if (token === "HH") return m.orthocenter;
      return token[0] === "A" ? A[Number(token[1])] : m.feet[Number(token[1])];
    };
    arcs.forEach((arc, idx) => {
      const [v, p, q] = arcSpecs[idx];
      const first = idx < 2;
      const on = state.showHint && !m.degenerate &&
        (state.N < 3 ? (first || state.N === 2) : false) && at(v) && at(p) && at(q);
      arc.show(Boolean(on));
      if (on) arc.set(at(v), at(p), at(q), arcSpecs[idx][3] === 1 ? 14 : arcSpecs[idx][3] === 2 ? 11 : 9);
    });

    for (let i = 0; i < 3; i++) {
      hA[i].set(A[i]);
      hP[i].set(P[i]);
    }

    if (m.degenerate || !m.orthocenter) {
      say("Move the corners apart to make a triangle, then drag a dot on a side.");
    } else if (state.N === 1) {
      say(`The circle on CPc cuts AB again at Hc. Powers at H: ${fmt(m.powers[2])}. Add a second cevian to see the common line.`);
    } else if (state.N === 2) {
      say(`The green radical axis passes through H, where the altitudes meet. Powers at H: ${fmt(m.powers[2])} and ${fmt(m.powers[0])}.`);
    } else {
      say(`All three radical axes meet at H: its powers are ${fmt(m.powers[0])}, ${fmt(m.powers[1])} and ${fmt(m.powers[2])}.`);
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  const clampFoot = (p, name) => {
    const i = Number(name.slice(1));
    const [j, k] = Core.other(i);
    const dx = state.A[k].x - state.A[j].x, dy = state.A[k].y - state.A[j].y;
    const len2 = dx * dx + dy * dy;
    const t = len2 < Core.EPS ? 0.5 : Geom.clamp(
      ((p.x - state.A[j].x) * dx + (p.y - state.A[j].y) * dy) / len2, 0, 1);
    return { x: state.A[j].x + dx * t, y: state.A[j].y + dy * t };
  };

  const hA = [0, 1, 2].map((i) => board.handle("A" + i, state.A[i], {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
    label: `Corner ${names[i]}. Drag, or focus and use the arrow keys to move it.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, name) => { state = Core.withVertex(state, Number(name.slice(1)), p); render(); },
  }));
  const hP = [0, 1, 2].map((i) => board.handle("P" + i, state.P[i], {
    r: 8, step: 2, shift: 8, cls: "geom-handle foot-handle", layer: handlesLayer,
    clamp: clampFoot,
    label: `Point on the side opposite ${names[i]}. Drag it along the side, or use the arrow keys.`,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, name) => { state = Core.withFoot(state, Number(name.slice(1)), p); render(); },
  }));

  function setN(n) {
    state = Core.withOption(state, "N", n);
    render();
  }

  function toggleNames() {
    state = Core.withOption(state, "showNames", !state.showNames);
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    render();
  }

  function toggleHint() {
    if (state.N === 3) return; // the applet disables Hint with three cevians
    state = Core.withOption(state, "showHint", !state.showHint);
    hintBtn.setAttribute("aria-pressed", String(state.showHint));
    hintBtn.textContent = state.showHint ? "Hide hint" : "Show hint";
    render();
  }

  function newGame() {
    state = Core.start({ N: state.N, showNames: state.showNames, showHint: state.showHint });
    render();
    hA[0].node.focus();
  }

  newBtn.addEventListener("click", newGame);
  nBtns.forEach((btn, i) => btn.addEventListener("click", () => setN(i + 1)));
  namesBtn.addEventListener("click", toggleNames);
  hintBtn.addEventListener("click", toggleHint);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") newGame();
    if (e.key === "1") setN(1);
    if (e.key === "2") setN(2);
    if (e.key === "3") setN(3);
    if (e.key === "n" || e.key === "N") toggleNames();
    if (e.key === "h" || e.key === "H") toggleHint();
  });

  board.onTheme(render);
  render();
})();
