"use strict";

/*
 * The page for BOL3: drawing and input only; the mathematics is in
 * bol-3-core.js. An SVG holds the circle with diameter AB, the draggable point
 * P, its perpendicular foot N, the reflected point D and the point Q on the
 * circle with PA = PQ. The buttons repeat the applet's three "Show" options
 * (names, hint, statement) and a Reset. The status line reports BQ and BD.
 */

(function () {
  const Core = Bol3Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const marksBtn = document.getElementById("marksBtn");

  let state = Core.start();
  let checked = false;
  let showNames = true;
  let showHint = false;
  let showMarks = false;

  const shapes = board.layer("shapes");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Every element is made once; a redraw only changes its geometry. */
  const first = Core.measure(state);
  const bigCircle = board.circle(state.A, 1, "big-circle", shapes);
  const diameter = board.segment(state.A, state.B, "diameter", shapes);
  const spokes = [
    board.segment(state.A, state.P, "chord-ap", guides),
    board.segment(state.P, first.N, "drop", guides),
    board.segment(state.P, first.D, "proof-line", guides),
    board.segment(state.P, first.Q, "chord-pq", guides),
    board.segment(first.Q, state.B, "chord-qb", guides),
  ];
  const hintLines = [
    board.segment(state.P, state.B, "hint-line", guides),
    board.segment(state.A, first.Q, "hint-line", guides),
    board.segment(first.D, first.Q, "hint-line", guides),
  ];
  const rightAngle = board.rightAngle(state.A, state.B, state.P, 11, "right-angle", marks);
  const dots = {
    A: board.point(state.A, "fixed-dot", 4.5, marks),
    B: board.point(state.B, "fixed-dot", 4.5, marks),
    N: board.point(first.N, "aux-dot", 4, marks),
    D: board.point(first.D, "aux-dot", 4, marks),
    Q: board.point(first.Q, "q-dot", 5, marks),
  };

  /* One, two or three short strokes across the midpoint of an equal pair. */
  function tickGroup(count, cls) {
    return Array.from({ length: count }, () => board.segment(state.A, state.B, cls, marks));
  }
  const ticks = {
    AN: tickGroup(1, "tick equal-once"), ND: tickGroup(1, "tick equal-once"),
    AP: tickGroup(2, "tick equal-twice"), PQ: tickGroup(2, "tick equal-twice"),
    BQ: tickGroup(3, "tick equal-thrice"), BD: tickGroup(3, "tick equal-thrice"),
    DP: tickGroup(2, "tick hint-tick"),
  };
  function setTicks(group, p, q, on, spacing) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    group.forEach((tick, i) => {
      tick.show(on);
      if (!on) return;
      const shift = (i - (group.length - 1) / 2) * (spacing || 5);
      const c = { x: mid.x + nx * shift, y: mid.y + ny * shift };
      tick.set({ x: c.x - nx * 5 - (dx / len) * 4, y: c.y - ny * 5 - (dy / len) * 4 },
        { x: c.x + nx * 5 + (dx / len) * 4, y: c.y + ny * 5 + (dy / len) * 4 });
    });
  }

  const labels = {
    A: board.label(state.A, "A", "glabel", -18, 20, labelsLayer),
    B: board.label(state.B, "B", "glabel", 8, 20, labelsLayer),
    N: board.label(first.N, "N", "glabel", -5, 20, labelsLayer),
    D: board.label(first.D, "D", "glabel", -5, 20, labelsLayer),
    Q: board.label(first.Q, "Q", "glabel", 9, -10, labelsLayer),
  };

  /** The status line; "done" is how the record sees a finished exploration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  function render() {
    const m = Core.measure(state);
    bigCircle.set(m.O, m.R);
    diameter.set(m.A, m.B);
    spokes[0].set(m.A, m.P);
    spokes[1].set(m.P, m.N);
    spokes[2].set(m.P, m.D);
    spokes[3].set(m.P, m.Q);
    spokes[4].set(m.Q, m.B);
    hintLines.forEach((line, i) => {
      line.show(showHint);
      if (showHint) line.set([m.P, m.A, m.D][i], [m.B, m.Q, m.Q][i]);
    });
    rightAngle.set(m.N, m.P, m.A, 11);

    dots.A.set(m.A);
    dots.B.set(m.B);
    dots.N.set(m.N);
    dots.D.set(m.D);
    dots.Q.set(m.Q);
    labels.A.set(m.A);
    labels.B.set(m.B);
    labels.N.set(m.N);
    labels.D.set(m.D);
    labels.Q.set(m.Q);
    Object.values(labels).forEach((label) => label.show(showNames));

    setTicks(ticks.AN, m.A, m.N, showMarks);
    setTicks(ticks.ND, m.N, m.D, showMarks);
    setTicks(ticks.AP, m.A, m.P, showMarks || showHint, 6);
    setTicks(ticks.PQ, m.P, m.Q, showMarks || showHint, 6);
    setTicks(ticks.BQ, m.B, m.Q, showMarks, 6);
    setTicks(ticks.BD, m.B, m.D, showMarks, 6);
    setTicks(ticks.DP, m.D, m.P, showHint, 6);
    hP.set(m.P);

    if (checked) {
      say(`BQ = BD: both are ${fmt(m.BQ)}. Drag P to try another spot.`, "done");
    } else {
      say(`BQ = ${fmt(m.BQ)} and BD = ${fmt(m.BD)}. Drag P, or press Check the lengths.`);
    }
    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state(state);
  }

  const hP = board.handle("P", state.P, {
    r: 10, step: 3, shift: 15, layer: handlesLayer,
    clamp: (q) => Core.onCircle(state, q),
    label: "Point P on the circle. Drag it, or focus it and use the arrow keys to move it.",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      state = Core.withP(state, p);
      checked = false;
      render();
    },
  });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    hP.node.focus();
  }

  function checkLengths() {
    const claims = Core.claims(state);
    checked = Object.values(claims).every(Boolean);
    render();
    if (!checked) say("Move P away from A or B, then check again.");
  }

  function toggle(btn, get, set) {
    set(!get());
    btn.setAttribute("aria-pressed", String(get()));
    render();
  }

  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", checkLengths);
  namesBtn.addEventListener("click", () =>
    toggle(namesBtn, () => showNames, (v) => {
      showNames = v;
      namesBtn.textContent = v ? "Hide labels" : "Show labels";
    }));
  hintBtn.addEventListener("click", () =>
    toggle(hintBtn, () => showHint, (v) => {
      showHint = v;
      hintBtn.textContent = v ? "Hide proof lines" : "Show proof lines";
    }));
  marksBtn.addEventListener("click", () =>
    toggle(marksBtn, () => showMarks, (v) => {
      showMarks = v;
      marksBtn.textContent = v ? "Hide equal marks" : "Show equal marks";
    }));
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "c") checkLengths();
  });

  board.onTheme(render);
  render();
})();
