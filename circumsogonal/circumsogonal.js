"use strict";

/*
 * The page for Isogonal Image of the Circumcircle: drawing and input only; the
 * geometry is in circumsogonal-core.js. The SVG holds triangle ABC on its
 * circumcircle and a point P with its lines to the corners. At each corner the
 * reflected line is drawn right across the board, with matching angle marks
 * (one, two and three arcs at A, B and C). Off the circle the three lines meet
 * at Q; on it they are parallel and two angles at C are marked instead.
 * Drag A, B, C or P, or drag inside the triangle to move the whole triangle.
 */

(function () {
  const Core = CircumsogonalCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const snapBtn = document.getElementById("snapBtn");

  let state = Core.start({});

  /** An illustration has no win or loss; the record reads Track.state. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const circleLayer = board.layer("circle");
  const fillLayer = board.layer("fill");
  const lineLayer = board.layer("lines");
  const arcLayer = board.layer("arcs");
  const sideLayer = board.layer("sides");
  const markLayer = board.layer("marks");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const circum = board.circle(state.A, 1, "circum-circle", circleLayer);
  const body = board.polygon([state.A, state.B, state.C], "tri-body", fillLayer);
  const isoLines = [0, 1, 2].map(() => board.line(state.A, state.B, "iso-line", lineLayer));
  const pLines = [0, 1, 2].map(() => board.segment(state.P, state.A, "p-line", lineLayer));
  const sides = [0, 1, 2].map(() => board.segment(state.A, state.B, "tri-side", sideLayer));
  /* Up to three concentric arcs at each corner, for each of the two equal angles. */
  const arcs = [0, 1, 2].map(() => [0, 1].map(() => [0, 1, 2].map(() =>
    board.angleArc(state.A, state.B, state.C, 20, "angle-arc", arcLayer))));
  const parArcs = [0, 1].map((i) => [0, 1].map(() =>
    board.angleArc(state.A, state.B, state.C, 20, "par-arc" + (i ? " two" : ""), arcLayer)));
  const qDot = board.point(state.A, "q-dot", 5, markLayer);
  const labels = {
    A: board.label(state.A, "A", "glabel", 0, 0, labelLayer),
    B: board.label(state.B, "B", "glabel", 0, 0, labelLayer),
    C: board.label(state.C, "C", "glabel", 0, 0, labelLayer),
    P: board.label(state.P, "P", "glabel p-label", 0, 0, labelLayer),
    Q: board.label(state.P, "Q", "glabel q-label", 9, -9, labelLayer),
  };

  const fmt = (v) => Math.round(v);
  const describe = (p) => `At (${fmt(p.x)}, ${fmt(p.y)}).`;
  const clampToBoard = (q) => ({
    x: Math.max(4, Math.min(board.viewBox.width - 4, q.x)),
    y: Math.max(4, Math.min(board.viewBox.height - 4, q.y)),
  });
  const handles = {};
  for (const name of ["A", "B", "C", "P"]) {
    handles[name] = board.handle(name, state[name], {
      layer: handleLayer,
      r: 8,
      step: name === "P" ? 0.5 : 2,
      shift: 10,
      cls: name === "P" ? "geom-handle p-handle" : "geom-handle",
      label: name === "P" ? "Point P" : `Corner ${name} of the triangle`,
      describe,
      clamp: clampToBoard,
      onMove: (p) => { state = Core.withPoint(state, name, p); render(); },
    });
  }

  /** A label just outside the triangle, away from its centroid. */
  function labelAt(lbl, p, away) {
    const dx = p.x - away.x, dy = p.y - away.y, d = Math.hypot(dx, dy) || 1;
    lbl.set(p, undefined, (dx / d) * 16 - 5, (dy / d) * 16 + 5);
  }

  function setArcs(set, V, p1, p2, q1, q2, n, r) {
    for (let k = 0; k < 3; k++) {
      set[0][k].show(k < n).set(V, p1, p2, r + 3 * k);
      set[1][k].show(k < n).set(V, q1, q2, r + 3 * k);
    }
  }

  function render() {
    const s = state;
    const m = Core.measurements(s);
    const g = { x: (s.A.x + s.B.x + s.C.x) / 3, y: (s.A.y + s.B.y + s.C.y) / 3 };
    const ok = !m.degenerate;

    circum.show(ok);
    if (ok) circum.set(m.circle.center, m.circle.r);
    body.set([s.A, s.B, s.C]);
    [[s.A, s.B], [s.B, s.C], [s.C, s.A]].forEach((e, i) => sides[i].set(e[0], e[1]));
    ["A", "B", "C"].forEach((v, i) => pLines[i].set(s.P, s[v]));

    const L = [m.lines.A, m.lines.B, m.lines.C];
    L.forEach((l, i) => {
      isoLines[i].set(l.vertex, l.R).show(ok);
      setArcs(arcs[i], l.vertex, s.P, l.from, l.to, l.R, i + 1, 20 + 10 * i);
      arcs[i].forEach((pair) => pair.forEach((a) => { if (!ok) a.show(false); }));
    });

    parArcs.forEach((pair, i) => {
      const a = m.parallelArcs[i];
      pair.forEach((arc, k) => {
        arc.show(Boolean(a) && ok);
        if (a) arc.set(a.vertex, a.from, a.to, 20 + 10 * i + 3 * k);
        if (k >= i + 1) arc.show(false);
      });
    });

    const showQ = ok && m.Q !== null;
    const qInside = showQ && m.Q.x >= 0 && m.Q.x <= board.viewBox.width && m.Q.y >= 0 && m.Q.y <= board.viewBox.height;
    qDot.show(qInside);
    labels.Q.show(qInside);
    if (qInside) { qDot.set(m.Q); labels.Q.set(m.Q); }

    for (const v of ["A", "B", "C"]) labelAt(labels[v], s[v], g);
    labelAt(labels.P, s.P, ok ? m.circle.center : g);
    for (const name of ["A", "B", "C", "P"]) handles[name].set(s[name]);

    if (m.degenerate) {
      say("A, B and C are in one line: pull a corner away to make a triangle again.");
    } else if (m.onCircle) {
      say("P is on the circle: the three reflected lines are parallel. They meet only at infinity.");
    } else if (m.Q === null) {
      say("The reflected lines are almost parallel: their meeting point is very far away.");
    } else if (qInside) {
      say(`The three reflected lines meet at Q, the isogonal conjugate of P. P is ${m.gap.toFixed(1)} away from the circle.`);
    } else {
      say(`The three reflected lines meet at Q (${fmt(m.Q.x)}, ${fmt(m.Q.y)}), off the board. Move P away from the circle to bring Q closer.`);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state({ A: s.A, B: s.B, C: s.C, P: s.P });
  }

  /* Drag inside the triangle to move all three corners together, as the
     applet's MoveablePoly does. */
  let grab = null;
  body.node.addEventListener("pointerdown", (e) => {
    grab = board.toLocal(e.clientX, e.clientY);
    board.root.setPointerCapture && board.root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!grab) return;
    const q = board.toLocal(e.clientX, e.clientY);
    state = Core.shiftTriangle(state, q.x - grab.x, q.y - grab.y);
    grab = q;
    render();
  });
  const drop = () => { grab = null; };
  board.root.addEventListener("pointerup", drop);
  board.root.addEventListener("pointercancel", drop);

  function newGame() {
    state = Core.start({});
    render();
  }

  /* Put P back on the circle, straight out from the centre. */
  snapBtn.addEventListener("click", () => {
    const m = Core.measurements(state);
    if (m.degenerate) return;
    const c = m.circle.center, d = Core.distance(state.P, c) || 1;
    state = Core.withPoint(state, "P", {
      x: c.x + ((state.P.x - c.x) / d) * m.circle.r,
      y: c.y + ((state.P.y - c.y) / d) * m.circle.r,
    });
    render();
  });
  newBtn.addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "r" || e.key === "R") newGame();
  });

  newGame();
})();
