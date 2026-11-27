"use strict";

/*
 * The page for Chasles Tangents: drawing and input only; the mathematics and
 * the construction are in chasles-tangents-core.js. The SVG holds a circle,
 * the fixed tangent touching it at T, the tangents at A, B, C, D, the four
 * crossings A'..D' on the fixed tangent, and draggable points A..D, K and T.
 * Two small grey handles move the circle's centre and its radius. The maths
 * section explains why the number read from K never changes.
 */

(function () {
  const Core = ChaslesTangentsCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");

  const view = board.viewBox;
  const guides = board.layer("guides");
  const tangentLayer = board.layer("tangents");
  const hintLayer = board.layer("hints");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  let state = Core.start({});
  let explored = false;

  const circle = board.circle(state.circle.center, state.circle.r, "conic", guides);
  const tangentT = board.line(state.points.T, state.points.T, "tangent-fixed", tangentLayer);
  const tangents = {};
  for (const nm of ["A", "B", "C", "D"]) {
    tangents[nm] = board.line(state.points[nm], state.points[nm], "tangent", tangentLayer);
  }
  const primeDots = {};
  for (const nm of ["Ap", "Bp", "Cp", "Dp"]) {
    primeDots[nm] = board.point(state.points.A, "prime-dot", 4.5, marks);
  }

  const hints = [
    board.segment(state.points.A, state.points.A, "hint-line", hintLayer),
    board.segment(state.points.A, state.points.A, "hint-line", hintLayer),
    board.segment(state.points.A, state.points.A, "hint-line", hintLayer),
    board.segment(state.points.A, state.points.A, "hint-line", hintLayer),
    board.segment(state.points.A, state.points.A, "hint-line", hintLayer),
  ];
  const arcO = board.angleArc(state.circle.center, state.points.A, state.points.T, 26, "angle-arc", hintLayer);
  const arcK = board.angleArc(state.points.K, state.points.A, state.points.T, 24, "angle-arc-k", hintLayer);

  const texts = {};
  for (const nm of [...Core.NAMES, "Ap", "Bp", "Cp", "Dp", "O", "t"]) {
    texts[nm] = board.label(state.points.A, nm, "glabel", 8, -8, labels);
  }

  /** The status line. A demo has no win or loss: it is "done" once explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function fmt(v) { return Number.isFinite(v) ? v.toFixed(3) : "—"; }

  function render() {
    const g = Core.compute(state);
    const cl = Core.claims(state);
    const p = state.points;

    circle.set(state.circle.center, state.circle.r);
    tangentT.show(Boolean(g.tangents.T));
    if (g.tangents.T) tangentT.set(g.tangents.T.a, g.tangents.T.b);

    for (const nm of ["A", "B", "C", "D"]) {
      const ln = g.tangents[nm];
      tangents[nm].show(Boolean(ln));
      if (ln) tangents[nm].set(ln.a, ln.b);
    }
    for (const nm of ["Ap", "Bp", "Cp", "Dp"]) {
      const on = finitePoint(g.primes[nm]);
      primeDots[nm].show(on);
      if (on) primeDots[nm].set(g.primes[nm]);
    }

    const o = state.circle.center;
    const ap = g.primes.Ap;
    const show = state.allowHint && cl.regular;
    hints.forEach((h) => h.show(show));
    if (show) {
      const ends = [
        [o, p.A], [o, ap], [o, p.T], [p.K, p.A], [p.K, p.T],
      ];
      ends.forEach(([a, b], i) => hints[i].set(a, b));
      arcO.show(true);
      arcO.set(o, ap, p.T, 26);
      arcK.show(true);
      arcK.set(p.K, p.A, p.T, 24);
    } else {
      arcO.show(false);
      arcK.show(false);
    }

    for (const nm of Core.NAMES) {
      texts[nm].show(state.showNames);
      if (state.showNames) texts[nm].set(p[nm]);
    }
    /* Put the four crossing names alternately above and below the tangent:
     * two of them can be close together when a tangent is nearly parallel. */
    const orderedPrimes = ["Ap", "Bp", "Cp", "Dp"]
      .filter((nm) => finitePoint(g.primes[nm]))
      .sort((a, b) => g.primes[a].x - g.primes[b].x);
    for (const nm of ["Ap", "Bp", "Cp", "Dp"]) {
      const on = state.showNames && finitePoint(g.primes[nm]);
      texts[nm].show(on);
      if (on) {
        const i = orderedPrimes.indexOf(nm);
        texts[nm].set(g.primes[nm], nm, -4, i % 2 === 0 ? -12 : 19);
      }
    }
    texts.O.show(state.allowHint);
    if (state.allowHint) texts.O.set(o);
    texts.t.show(true);
    texts.t.set({ x: view.x + 10, y: p.T.y - 10 }, "t", 0, 0);

    if (pointHandles) {
      for (const nm of Core.NAMES) pointHandles[nm].set(p[nm]);
    }
    if (centerHandle) centerHandle.set(o);
    if (radiusHandle) radiusHandle.set({ x: o.x + state.circle.r, y: o.y });

    if (!cl.regular) {
      say("Move the points apart so every tangent meets the fixed line again.", null);
    } else if (!explored) {
      say("Drag the blue dots around the circle. The number from K always matches the one from the four tangent crossings.", null);
    } else {
      let message = `K(ABCD) = ${fmt(cl.crK)} and (A'B'C'D') = ${fmt(cl.cr)}: the same number.`;
      if (state.allowHint) {
        message += cl.angleAtK
          ? " Angle AKT equals half of angle AOT here."
          : " Here angle AKT is the supplement of half of angle AOT, yet the number is unchanged.";
      }
      say(message, "done");
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function finitePoint(p) { return Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y); }

  function inside(q) {
    return {
      x: Geom.clamp(q.x, view.x + 8, view.x + view.width - 8),
      y: Geom.clamp(q.y, view.y + 8, view.y + view.height - 8),
    };
  }

  function clampPoint(q, name) {
    return Core.withPoint(state, name, inside(q)).points[name];
  }

  function clampCenter(q) {
    const p = inside(q);
    return {
      x: Geom.clamp(p.x, view.x + 70, view.x + view.width - 70),
      y: Geom.clamp(p.y, view.y + 55, view.y + view.height - 55),
    };
  }

  function clampRadius(q) {
    const o = state.circle.center;
    const dx = q.x - o.x, dy = q.y - o.y;
    const d = Math.hypot(dx, dy);
    const r = Geom.clamp(d, 20, 95);
    return d < 1e-9
      ? { x: o.x + r, y: o.y }
      : { x: o.x + (dx / d) * r, y: o.y + (dy / d) * r };
  }

  let pointHandles = null;
  let centerHandle = null;
  let radiusHandle = null;

  pointHandles = {};
  for (const nm of Core.NAMES) {
    pointHandles[nm] = board.handle(nm, state.points[nm], {
      r: 7, step: 3, shift: 12, layer: handlesLayer,
      clamp: clampPoint,
      label: `Point ${nm}. Drag it around the circle, or focus it and use the arrow keys.`,
      describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
      onMove: (q) => { state = Core.withPoint(state, nm, q); explored = true; render(); },
    });
  }

  centerHandle = board.handle("O", state.circle.center, {
    r: 5.5, step: 3, shift: 12, cls: "geom-handle corner-handle", layer: handlesLayer,
    clamp: clampCenter,
    label: "Circle centre. Drag, or focus and use the arrow keys, to move the circle.",
    describe: (q) => `at ${Math.round(q.x)}, ${Math.round(q.y)}`,
    onMove: (q) => { state = Core.withCenter(state, q); explored = true; render(); },
  });

  radiusHandle = board.handle("R", { x: state.circle.center.x + state.circle.r, y: state.circle.center.y }, {
    r: 5.5, step: 3, shift: 12, cls: "geom-handle corner-handle", layer: handlesLayer,
    clamp: clampRadius,
    label: "Circle radius. Drag, or focus and use the arrow keys, to resize the circle.",
    describe: (q) => `radius ${Math.round(Math.hypot(q.x - state.circle.center.x, q.y - state.circle.center.y))}`,
    onMove: (q) => { state = Core.withRadius(state, q); explored = true; render(); },
  });

  function syncButtons() {
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    hintBtn.setAttribute("aria-pressed", String(state.allowHint));
    hintBtn.textContent = state.allowHint ? "Hide hint" : "Allow hint";
  }

  function reset() {
    const showNames = state.showNames; // the applet's checkboxes keep their settings
    const allowHint = state.allowHint;
    state = Core.withHint(Core.withNames(Core.start({}), showNames), allowHint);
    explored = false;
    syncButtons();
    render();
    pointHandles.A.node.focus();
  }

  function toggleNames() {
    state = Core.withNames(state, !state.showNames);
    explored = true;
    syncButtons();
    render();
  }

  function toggleHint() {
    state = Core.withHint(state, !state.allowHint);
    explored = true;
    syncButtons();
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  hintBtn.addEventListener("click", toggleHint);
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "n" || e.key === "N") toggleNames();
    if (e.key === "h" || e.key === "H") toggleHint();
  });
  board.onTheme(render);
  syncButtons();
  render();
})();
