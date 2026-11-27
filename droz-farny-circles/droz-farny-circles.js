"use strict";

/*
 * The page for Droz Farny Circles: drawing and input only. The geometry lives
 * in droz-farny-circles-core.js. The SVG shows triangle ABC, the draggable
 * point P, its isogonal conjugate Q, the feet of the perpendiculars to the
 * side lines and, when asked for, the two families of circles and their six
 * cut points each. Drag a dot (or the triangle's inside), or focus a dot and
 * use the arrow keys. The six checkboxes are the applet's own "Show" options.
 */

(function () {
  const Core = DrozFarnyCirclesCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const defaults = { perps: false, circlesP: false, circlesQ: false, radii: false, angles: false, names: false };
  const flags = { ...defaults };
  let state = Core.start({});

  /** An illustration has no win or loss; the record reads Track.state. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Paint order: triangle, rays, perpendiculars, circles, cut points, labels,
     handles. Geom layers are created in the order given here. */
  const fillLayer = board.layer("fill");
  const rayLayer = board.layer("rays");
  const perpLayer = board.layer("perps");
  const circleLayer = board.layer("circles");
  const dotLayer = board.layer("dots");
  const arcLayer = board.layer("arcs");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const body = board.polygon([state.A, state.B, state.C], "tri-fill", fillLayer);
  const sides = [0, 1, 2].map(() => board.segment(state.A, state.B, "tri-side", rayLayer));
  const pRays = [0, 1, 2].map(() => board.segment(state.P, state.A, "p-ray", rayLayer));
  const qRays = [0, 1, 2].map(() => board.line(state.P, state.A, "q-ray", rayLayer));
  const pPerps = [0, 1, 2].map(() => board.segment(state.P, state.A, "perp-p", perpLayer));
  const qPerps = [0, 1, 2].map(() => board.segment(state.P, state.A, "perp-q", perpLayer));
  const smallP = [0, 1, 2].map(() => board.circle(state.A, 1, "small-circle small-p", circleLayer));
  const smallQ = [0, 1, 2].map(() => board.circle(state.A, 1, "small-circle small-q", circleLayer));
  const bigP = board.circle(state.A, 1, "big-circle big-p", circleLayer);
  const bigQ = board.circle(state.A, 1, "big-circle big-q", circleLayer);
  const radiiP = [0, 1, 2].map(() => board.segment(state.A, state.P, "radius-line radius-p", perpLayer));
  const radiiQ = [0, 1, 2].map(() => board.segment(state.A, state.P, "radius-line radius-q", perpLayer));
  const cutP = [0, 1, 2, 3, 4, 5].map(() => board.point(state.A, "cut-dot cut-p", 3.4, dotLayer));
  const cutQ = [0, 1, 2, 3, 4, 5].map(() => board.point(state.A, "cut-dot cut-q", 3.4, dotLayer));
  const qDot = board.point(state.A, "q-dot", 4.5, dotLayer);
  const arcs = [0, 1, 2].map(() => [0, 1].map(() =>
    board.angleArc(state.A, state.B, state.C, 18, "angle-arc", arcLayer)));

  const labels = {
    A: board.label(state.A, "A", "glabel", -12, -10, labelLayer),
    B: board.label(state.B, "B", "glabel", -12, 18, labelLayer),
    C: board.label(state.C, "C", "glabel", 8, 16, labelLayer),
    P: board.label(state.P, "P", "glabel p-label", 8, -8, labelLayer),
    Q: board.label(state.A, "Q", "glabel q-label", 8, -8, labelLayer),
  };
  const footLabels = {};
  for (const name of ["Pa", "Pb", "Pc", "Qa", "Qb", "Qc"]) {
    footLabels[name] = board.label(state.A, name, "glabel foot-label", 6, -6, labelLayer);
  }

  const clamp = (q) => ({
    x: Math.max(4, Math.min(board.viewBox.width - 4, q.x)),
    y: Math.max(4, Math.min(board.viewBox.height - 4, q.y)),
  });
  const describe = (p) => `At (${Math.round(p.x)}, ${Math.round(p.y)}).`;
  const handles = {};
  for (const name of ["A", "B", "C", "P"]) {
    handles[name] = board.handle(name, state[name], {
      layer: handleLayer,
      r: 9,
      step: name === "P" ? 1 : 2,
      shift: 10,
      label: name === "P" ? "Point P" : `Corner ${name} of the triangle`,
      describe,
      clamp,
      onMove: (p) => { state = Core.withPoint(state, name, p); render(); },
    });
  }

  function putDots(dots, pairs) {
    pairs.forEach((pair, i) => {
      const has = Boolean(pair) && pair.length === 2;
      dots[2 * i].show(has);
      dots[2 * i + 1].show(has);
      if (has) { dots[2 * i].set(pair[0]); dots[2 * i + 1].set(pair[1]); }
    });
  }

  function render() {
    const s = state;
    const m = Core.measurements(s);
    const ok = !m.degenerate && m.Q !== null;
    const inside = (p) => p.x >= 0 && p.x <= board.viewBox.width && p.y >= 0 && p.y <= board.viewBox.height;
    const pFeet = [m.feet.P.a, m.feet.P.b, m.feet.P.c];
    const qFeet = ok ? [m.feet.Q.a, m.feet.Q.b, m.feet.Q.c] : [];

    body.set([s.A, s.B, s.C]);
    [[s.A, s.B], [s.B, s.C], [s.C, s.A]].forEach((e, i) => sides[i].set(e[0], e[1]));
    ["A", "B", "C"].forEach((v, i) => pRays[i].set(s.P, s[v]));
    qRays.forEach((line, i) => {
      line.show(ok);
      if (ok) line.set(m.Q, s[["A", "B", "C"][i]]);
    });

    pPerps.forEach((seg, i) => { seg.show(flags.perps); seg.set(s.P, pFeet[i]); });
    qPerps.forEach((seg, i) => {
      seg.show(flags.perps && ok);
      if (ok) seg.set(m.Q, qFeet[i]);
    });

    const showP = flags.circlesP && ok;
    const showQ = flags.circlesQ && ok;
    smallP.forEach((c, i) => {
      c.show(showP);
      if (showP) c.set(pFeet[i], Core.distance(pFeet[i], m.Q));
    });
    smallQ.forEach((c, i) => {
      c.show(showQ);
      if (showQ) c.set(qFeet[i], Core.distance(qFeet[i], s.P));
    });
    const drawP = showP && Boolean(m.big.P) && Core.finite(m.big.P.center);
    const drawQ = showQ && Boolean(m.big.Q) && Core.finite(m.big.Q.center);
    bigP.show(drawP);
    if (drawP) bigP.set(m.big.P.center, m.big.P.r);
    bigQ.show(drawQ);
    if (drawQ) bigQ.set(m.big.Q.center, m.big.Q.r);
    radiiP.forEach((seg, i) => { seg.show(flags.radii && showP); if (showP) seg.set(pFeet[i], m.Q); });
    radiiQ.forEach((seg, i) => { seg.show(flags.radii && showQ); if (showQ) seg.set(qFeet[i], s.P); });
    putDots(cutP, showP ? m.cuts.P : [null, null, null]);
    putDots(cutQ, showQ ? m.cuts.Q : [null, null, null]);

    qDot.show(ok && inside(m.Q));
    if (ok && inside(m.Q)) qDot.set(m.Q);

    const L = [m.lines.A, m.lines.B, m.lines.C];
    arcs.forEach((pair, i) => {
      const l = L[i], radius = 18 + 7 * i;
      pair.forEach((arc, k) => {
        arc.show(flags.angles && !m.degenerate);
        if (!m.degenerate) arc.set(l.vertex, k === 0 ? s.P : l.to, k === 0 ? l.from : l.R, radius + 3 * k);
      });
    });

    labels.A.set(s.A); labels.B.set(s.B); labels.C.set(s.C); labels.P.set(s.P);
    labels.Q.show(ok && inside(m.Q) && flags.names);
    if (ok && inside(m.Q)) labels.Q.set(m.Q);
    const pNames = ["Pa", "Pb", "Pc"], qNames = ["Qa", "Qb", "Qc"];
    pFeet.forEach((f, i) => {
      const show = flags.names && (flags.perps || (flags.circlesP && flags.radii));
      footLabels[pNames[i]].show(show);
      if (show) footLabels[pNames[i]].set(f);
    });
    qFeet.forEach((f, i) => {
      const show = flags.names && ok && (flags.perps || (flags.circlesQ && flags.radii));
      footLabels[qNames[i]].show(show);
      if (show) footLabels[qNames[i]].set(f);
    });
    for (const name of ["A", "B", "C", "P"]) handles[name].set(s[name]);

    if (m.degenerate) {
      say("A, B and C are in one line: pull a corner away to make a triangle again.");
    } else if (!ok) {
      say("P is on the circle through A, B and C: Q has gone far away, so the Droz-Farny circles are not drawn.");
    } else if (flags.circlesP && flags.circlesQ && m.big.P && m.big.Q) {
      say(`Q is at (${Math.round(m.Q.x)}, ${Math.round(m.Q.y)}). Both circles have radius ${m.big.P.r.toFixed(1)}.`);
    } else if (flags.circlesP && m.big.P) {
      say(`The six points on the side lines lie on a circle centred at P, radius ${m.big.P.r.toFixed(1)}.`);
    } else if (flags.circlesQ && m.big.Q) {
      say(`The six points on the side lines lie on a circle centred at Q, radius ${m.big.Q.r.toFixed(1)}.`);
    } else {
      say(`Q is the isogonal conjugate of P, at (${Math.round(m.Q.x)}, ${Math.round(m.Q.y)}). Show the circles to see the six cut points.`);
    }

    // The position, for the player's record and the tutor, in board units.
    if (window.Track) window.Track.state({ A: s.A, B: s.B, C: s.C, P: s.P, Q: m.Q });
  }

  /* Drag inside the triangle to move all three corners, as the applet's
     MoveablePoly does. */
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

  const inputs = {
    perps: document.getElementById("perpsBox"),
    circlesP: document.getElementById("circlesPBox"),
    circlesQ: document.getElementById("circlesQBox"),
    radii: document.getElementById("radiiBox"),
    angles: document.getElementById("anglesBox"),
    names: document.getElementById("namesBox"),
  };
  function syncOptions() {
    for (const key in inputs) inputs[key].checked = flags[key];
    inputs.radii.disabled = !(flags.circlesP || flags.circlesQ);
  }
  for (const key in inputs) {
    inputs[key].addEventListener("change", () => {
      flags[key] = inputs[key].checked;
      syncOptions();
      render();
    });
  }

  function newGame() {
    state = Core.start({});
    Object.assign(flags, defaults);
    syncOptions();
    render();
  }
  document.getElementById("newBtn").addEventListener("click", newGame);
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "r" || e.key === "R") newGame();
  });

  board.onTheme(() => render());
  syncOptions();
  newGame();
})();
