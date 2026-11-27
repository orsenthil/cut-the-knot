"use strict";

/*
 * The page for The Cleaver: drawing and input only; the geometry is in
 * cleaver-core.js. The SVG holds triangle ABC with the bisector CL, the
 * midpoint M of AB, the line MD parallel to CL, and the extension CF of the
 * longer side with CF equal to the shorter side. "Premise" adds the angle
 * marks at C, the equal halves of AB and the equal pair CF, CB; "Statement"
 * adds the equal halves of SF that prove the perimeter is cut in two.
 * Corners drag (or move with the arrow keys); the inside drags the triangle.
 */

(function () {
  const Core = CleaverCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBox = document.getElementById("namesBox");
  const premiseBox = document.getElementById("premiseBox");
  const statementBox = document.getElementById("statementBox");

  let state = Core.start({});

  /** An illustration has no win or loss; the record reads Track.state. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Arrowheads for the measuring arrows. */
  const defs = board.el("defs", null, null);
  const marker = Geom.el("marker", {
    id: "cleaver-arrow", viewBox: "0 0 10 10", refX: "9", refY: "5",
    markerWidth: "7", markerHeight: "7", orient: "auto-start-reverse",
  }, null, defs);
  Geom.el("path", { d: "M 0 0 L 10 5 L 0 10 z" }, "arrow-head", marker);

  const fillLayer = board.layer("fill");
  const lineLayer = board.layer("lines");
  const premLayer = board.layer("premise");
  const stmtLayer = board.layer("statement");
  const dotLayer = board.layer("dots");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const s0 = state;
  const body = board.polygon([s0.A, s0.B, s0.C], "tri-body", fillLayer);
  const sides = [0, 1, 2].map(() => board.segment(s0.A, s0.B, "tri-side", lineLayer));
  const cl = board.segment(s0.C, s0.A, "bisector", lineLayer);
  const md = board.segment(s0.A, s0.B, "cleaver", lineLayer);
  const cf = board.segment(s0.C, s0.A, "ext", lineLayer);
  const ft = board.segment(s0.C, s0.A, "ext", lineLayer);

  const halfArcs = [0, 1].map(() => [0, 1].map(() => board.angleArc(s0.C, s0.A, s0.B, 30, "angle-arc", premLayer)));
  const arrow = (layer, cls) => {
    const node = board.segment(s0.A, s0.B, "measure " + cls, layer);
    node.node.setAttribute("marker-start", "url(#cleaver-arrow)");
    node.node.setAttribute("marker-end", "url(#cleaver-arrow)");
    return node;
  };
  const vA = arrow(premLayer, "a"), vB = arrow(premLayer, "b");
  const premDot = board.point(s0.A, "measure-dot", 4, premLayer);
  const ticks = [0, 1].map(() => [0, 1].map(() => board.segment(s0.A, s0.B, "tick", premLayer)));
  const vS = arrow(stmtLayer, "s"), vF = arrow(stmtLayer, "f");
  const stmtDot = board.point(s0.A, "measure-dot", 4, stmtLayer);

  const dots = ["L", "M", "D", "F"].map((n) => [n, board.point(s0.A, "pt-dot" + (n === "M" || n === "D" ? " cut" : ""), 4.5, dotLayer)]);
  const names = {};
  for (const n of ["A", "B", "C", "M", "D", "F", "L"]) names[n] = board.label(s0.A, n, "glabel", 0, 0, labelLayer);

  const fmt = (v) => Math.round(v);
  const clampToBoard = (q) => ({
    x: Math.max(board.viewBox.x + 6, Math.min(board.viewBox.x + board.viewBox.width - 6, q.x)),
    y: Math.max(board.viewBox.y + 6, Math.min(board.viewBox.y + board.viewBox.height - 6, q.y)),
  });
  const handles = {};
  for (const n of ["A", "B", "C"]) {
    handles[n] = board.handle(n, state[n], {
      layer: handleLayer, r: 11, step: 2, shift: 12,
      label: `Corner ${n} of the triangle`,
      describe: (p) => `At (${fmt(p.x)}, ${fmt(p.y)}).`,
      clamp: clampToBoard,
      onMove: (p) => { state = Core.withPoint(state, n, p); render(); },
    });
  }

  /** Two tick marks across the middle of segment pq. */
  function setTicks(pair, p, q) {
    const mid = Core.midpoint(p, q), d = Core.distance(p, q) || 1;
    const u = { x: (q.x - p.x) / d, y: (q.y - p.y) / d }, n = { x: -u.y * 7, y: u.x * 7 };
    [-3, 3].forEach((o, i) => {
      const c = { x: mid.x + u.x * o, y: mid.y + u.y * o };
      pair[i].set({ x: c.x - n.x, y: c.y - n.y }, { x: c.x + n.x, y: c.y + n.y });
    });
  }

  /** A label pushed away from the triangle's centroid. */
  function place(lbl, p, g) {
    const dx = p.x - g.x, dy = p.y - g.y, d = Math.hypot(dx, dy) || 1;
    lbl.set(p, undefined, (dx / d) * 20 - 6, (dy / d) * 20 + 7);
  }

  function render() {
    const s = state;
    const m = Core.compute(s);
    const g = { x: (s.A.x + s.B.x + s.C.x) / 3, y: (s.A.y + s.B.y + s.C.y) / 3 };
    const ok = !m.degenerate;
    const S = s[m.S], T = s[m.T];

    body.set([s.A, s.B, s.C]);
    [[s.A, s.B], [s.B, s.C], [s.C, s.A]].forEach((e, i) => sides[i].set(e[0], e[1]));
    for (const el of [cl, md, cf, ft]) el.show(ok);
    if (ok) {
      cl.set(s.C, m.L);
      md.set(m.M, m.D);
      cf.set(s.C, m.F);
      ft.set(m.F, T);
    }
    for (const [n, dot] of dots) { dot.show(ok); if (ok) dot.set(m[n]); }

    premLayer.style.display = premiseBox.checked && ok ? "" : "none";
    stmtLayer.style.display = statementBox.checked && ok ? "" : "none";
    if (ok) {
      halfArcs[0].forEach((a, k) => a.set(s.C, s.A, m.L, 30 + 4 * k));
      halfArcs[1].forEach((a, k) => a.set(s.C, m.L, s.B, 30 + 4 * k));
      vA.set(...m.premise.VA);
      vB.set(...m.premise.VB);
      premDot.set(m.premise.VA[0]);
      setTicks(ticks[0], s.C, m.F);
      setTicks(ticks[1], s.C, T);
      vS.set(...m.statement.VS);
      vF.set(...m.statement.VF);
      stmtDot.set(m.statement.VS[0]);
    }

    labelLayer.style.display = namesBox.checked ? "" : "none";
    for (const n of ["A", "B", "C"]) place(names[n], s[n], g);
    for (const n of ["M", "D", "F", "L"]) {
      names[n].show(ok);
      if (ok) place(names[n], m[n], n === "F" ? s.C : g);
    }
    for (const n of ["A", "B", "C"]) handles[n].set(s[n]);

    if (!ok) {
      say("The corners are in one line: pull one away to make a triangle again.");
    } else {
      const h = Core.halves(s);
      say(`${m.S}M + ${m.S}D = ${h.one.toFixed(1)} and ${m.T}M + ${m.T}C + CD = ${h.two.toFixed(1)}: ` +
        `each is half of the perimeter, ${h.perimeter.toFixed(1)}.`);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state({ A: s.A, B: s.B, C: s.C });
  }

  /* Drag inside the triangle to move all three corners together. */
  let grab = null;
  body.node.addEventListener("pointerdown", (e) => {
    grab = board.toLocal(e.clientX, e.clientY);
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!grab) return;
    const q = board.toLocal(e.clientX, e.clientY);
    state = Core.shift(state, q.x - grab.x, q.y - grab.y);
    grab = q;
    render();
  });
  const drop = () => { grab = null; };
  board.root.addEventListener("pointerup", drop);
  board.root.addEventListener("pointercancel", drop);

  function newGame() {
    state = Core.start({});
    namesBox.checked = false;
    premiseBox.checked = false;
    statementBox.checked = false;
    render();
  }

  for (const box of [namesBox, premiseBox, statementBox]) box.addEventListener("change", render);
  newBtn.addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "r" || e.key === "R") newGame();
  });

  newGame();
})();
