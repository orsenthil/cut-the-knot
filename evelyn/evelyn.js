"use strict";

/*
 * The page for Evelyn: drawing and input only; the geometry is in
 * evelyn-core.js. The board holds a triangle with three draggable corner dots
 * (A, B, C) and a fourth dot (P) that slides along A's angle bisector, exactly
 * as in the applet. Up to six tangent circles are drawn in the applet's red
 * and pink pair colours, and the seven checkbox buttons pick a pair to colour.
 */

(function () {
  const Core = EvelynCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const pairButtons = Array.from(document.querySelectorAll("[data-which]"));

  const guides = board.layer("guides");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const triangle = board.polygon([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], "tri-side", shapes);
  const bisector = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "guide-line", guides);
  const footDot = board.point({ x: 0, y: 0 }, "foot-dot", 3, marks);
  const circles = [];
  for (let k = 0; k < Core.PAIRS; k++) {
    circles.push(board.circle({ x: 0, y: 0 }, 1, "chain-circle", shapes));
  }
  const labels = ["A", "B", "C"].map((name) =>
    board.label({ x: 0, y: 0 }, name, "handle-label", 12, -10, marks));
  const pLabel = board.label({ x: 0, y: 0 }, "P", "handle-label p-label", 12, -10, marks);

  let state = Core.start({});
  let checked = false;
  let checkNote = "";
  let geomNow = Core.geometry(state);

  /** The status line; "done" marks a checked claim, never a win or a loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const near = (a, b) => Math.abs(a - b) < 1e-6;
  const clampToBoard = (q) => ({
    x: Core.clamp(q.x, 3, state.w - 3),
    y: Core.clamp(q.y, 3, state.h - 3),
  });

  /** Keep P on the segment from corner A to the opposite side. */
  function onBisector(q) {
    const a = geomNow.V[0];
    const foot = geomNow.L[0];
    if (![a, foot].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) return clampToBoard(q);
    const dx = foot.x - a.x;
    const dy = foot.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-9) return { x: a.x, y: a.y };
    const t = Core.clamp(((q.x - a.x) * dx + (q.y - a.y) * dy) / len2, 0, 1);
    return { x: a.x + t * dx, y: a.y + t * dy };
  }

  function render() {
    geomNow = Core.geometry(state);
    const drawn = Core.chain(state);
    const g = geomNow;
    const usable = g.V.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
      && g.L.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    triangle.set(g.V);
    bisector.show(usable);
    footDot.show(usable);
    if (usable) {
      bisector.set(g.V[0], g.L[0]);
      footDot.set(g.L[0]);
    }
    circles.forEach((c, i) => {
      const circle = drawn[i];
      if (!circle || !Number.isFinite(circle.r) || circle.r <= 0) {
        c.show(false);
        return;
      }
      c.set(circle, circle.r).show(true);
      c.node.setAttribute("class", "chain-circle " + (Core.isRed(state.which, i) ? "red" : "pink"));
    });
    labels.forEach((label, i) => label.set(g.V[i]));
    pLabel.set(g.P);
    hA.set(g.V[0]);
    hB.set(g.V[1]);
    hC.set(g.V[2]);
    hP.set(g.P);
    pairButtons.forEach((button) =>
      button.setAttribute("aria-pressed", String(Number(button.dataset.which) === state.which)));

    if (!usable || drawn.length === 0) {
      say("Move a corner so the triangle is not flat, then try again.");
    } else {
      const red = drawn.filter((c) => Core.isRed(state.which, c.k)).map((c) => c.k + 1);
      const pair = state.which === 6 ? "All six circles are red."
        : `Circles ${red.join(" and ")} are red.`;
      const extended = Core.extend(state, 7);
      const ending = extended.length > 6
        ? (near(extended[6].x, drawn[0].x) && near(extended[6].y, drawn[0].y)
            && near(extended[6].r, drawn[0].r)
            ? "The seventh circle lands on the first one again."
            : "The seventh circle would touch a side beyond the corner.")
        : "No seventh circle fits.";
      const base = `${drawn.length} circles drawn. ${pair} ${ending}`;
      if (checked) say(`Checked: ${base} ${checkNote}`, "done");
      else say(base + (checkNote ? " " + checkNote : ""));
    }
    if (window.Track) window.Track.state(state);
  }

  function changed(changes) {
    state = Core.withOptions(state, changes);
    checked = false;
    checkNote = "";
    render();
  }

  function setVertex(index, q) {
    const V = state.V.map((p, i) => (i === index ? q : p));
    changed({ V });
  }

  function reset() {
    state = Core.start({ which: state.which });
    checked = false;
    checkNote = "";
    render();
    hA.node.focus();
  }

  function setWhich(which) {
    changed({ which: Core.clampInt(which, 0, Core.PAIRS) });
  }

  function checkClaim() {
    const c = Core.claims(state);
    const ok = c.finite && c.touchesBothSides && c.neighboursTouch && c.feetOnSides
      && c.atMostSix && c.repeatsOrStops;
    checked = ok;
    checkNote = ok
      ? "Every circle touches its two sides and its neighbours."
      : "These circles do not all touch the sides as segments: move a corner or the starting dot.";
    render();
  }

  const hA = board.handle("A", state.V[0], {
    r: 9, step: 5, shift: 15, layer: handlesLayer, clamp: clampToBoard,
    label: "Corner A. Drag it, or focus it and use the arrow keys, to change the triangle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => setVertex(0, p),
  });
  const hB = board.handle("B", state.V[1], {
    r: 9, step: 5, shift: 15, layer: handlesLayer, clamp: clampToBoard,
    label: "Corner B. Drag it, or focus it and use the arrow keys, to change the triangle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => setVertex(1, p),
  });
  const hC = board.handle("C", state.V[2], {
    r: 9, step: 5, shift: 15, layer: handlesLayer, clamp: clampToBoard,
    label: "Corner C. Drag it, or focus it and use the arrow keys, to change the triangle.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => setVertex(2, p),
  });
  const hP = board.handle("P", geomNow.P, {
    r: 9, step: 6, shift: 18, layer: handlesLayer, clamp: onBisector,
    label: "Starting dot P. It slides along the dotted bisector at A; drag it or use the arrow keys.",
    describe: () => `at ${Math.round((1 - state.Ta) * 100)} percent along the bisector`,
    onMove: (p) => {
      const a = geomNow.V[0];
      const foot = geomNow.L[0];
      const dx = foot.x - a.x;
      const dy = foot.y - a.y;
      const len2 = dx * dx + dy * dy;
      if (len2 < 1e-9) return;
      const t = Core.clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
      changed({ Ta: 1 - t });
    },
  });

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkClaim);
  pairButtons.forEach((button) => button.addEventListener("click", () =>
    setWhich(Number(button.dataset.which))));
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") checkClaim();
    if (e.key === "0") setWhich(6);
    if (/^[1-6]$/.test(e.key)) setWhich(Number(e.key) - 1);
  });

  board.onTheme(render);
  render();
})();
