"use strict";

/*
 * The page for BID: drawing and input only; the construction is in
 * bid-core.js. The SVG holds an isosceles triangle and the chain of points
 * the applet builds from its base to its apex. Three vertices can be dragged
 * or moved with the arrow keys; the slider is the applet's angle scrollbar
 * (20 to 80 degrees, starting at 45). Nothing is won or lost here.
 */

(function () {
  const Core = BidCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const angleInput = document.getElementById("angle");
  const angleOut = document.getElementById("angleOut");
  const newBtn = document.getElementById("newBtn");
  const goldenBtn = document.getElementById("goldenBtn");

  let state = Core.start({ angle: 45 });

  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");
  const view = board.viewBox;
  const visible = (p) => Number.isFinite(p.x) && Number.isFinite(p.y) &&
    p.x > view.x - 20 && p.x < view.x + view.width + 20 &&
    p.y > view.y - 20 && p.y < view.y + view.height + 20;

  /* Objects are created once and only their geometry changes on a redraw. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const chain = Array.from({ length: 9 }, () => board.segment(state.A, state.B, "chain", shapes));
  const dots = Array.from({ length: 10 }, () => board.point(state.A, "chain-dot", 3.2, marks));
  const labels = Array.from({ length: 10 }, () => board.label(state.A, "", "glabel", 8, -6, marks));
  const apexArc = board.angleArc(state.A, state.B, state.C, 24, "apex-arc", marks);
  const angleLabel = board.label(state.A, "", "glabel angle-label", 26, 14, marks);

  /* Two ticks mean BC = BD, one tick means BE = DE = EF = FA. */
  const ticks = Array.from({ length: 6 }, () => [
    board.segment(state.A, state.B, "tick", marks),
    board.segment(state.A, state.B, "tick", marks),
  ]);
  function setTicks(which, p, q, count) {
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy);
    for (let i = 0; i < 2; i++) {
      const on = len > 12 && i < count;
      ticks[which][i].show(on);
      if (!on) continue;
      const ux = dx / len, uy = dy / len;
      const shift = count === 1 ? 0 : i === 0 ? -5 : 5;
      const mx = (p.x + q.x) / 2 + ux * shift;
      const my = (p.y + q.y) / 2 + uy * shift;
      ticks[which][i].set({ x: mx + uy * 4, y: my - ux * 4 },
                          { x: mx - uy * 4, y: my + ux * 4 });
    }
  }

  /** The line under the board; `kind` is never a win or a loss in an illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function describe(m) {
    const a = m.measuredAngle;
    if (a < 45) {
      return `Apex ${a.toFixed(1)}°: four isosceles triangles fill the big one.` +
        (m.golden ? ' At 36° the two pairs of triangles are similar — a golden triangle.' : "");
    }
    if (Math.abs(a - 45) < 1e-6) {
      return "Apex 45°: D and F are the same point, so only three triangles are left.";
    }
    if (a < 60 && m.F && m.D) {
      if (Core.distance(m.F, m.D) > 0.01 * m.lengths.BC) {
        return `Apex ${a.toFixed(1)}°: the equal sides still match, but F lies past D, so the lines cross.`;
      }
      return `Apex ${a.toFixed(1)}°: the circle at E just misses the line, so F stays at D.`;
    }
    return `Apex ${a.toFixed(1)}°: the chain stops before it reaches the apex.`;
  }

  function render() {
    const m = Core.analyze(state);
    const A = m.A, B = m.B, Cc = m.C;

    angleInput.value = String(Math.round(state.angle));
    angleOut.textContent = `${Math.round(state.angle)}°`;

    sides[0].set(A, B);
    sides[1].set(B, Cc);
    sides[2].set(Cc, A);

    for (let i = 0; i < chain.length; i++) {
      const q = m.points[i + 1];
      const p = m.points[i];
      const show = Boolean(p && q && visible(q) && q.y > A.y + 1);
      chain[i].show(show);
      if (show) chain[i].set(p, q);
    }
    for (let i = 0; i < dots.length; i++) {
      const p = m.points[i];
      const show = Boolean(p && visible(p) && i > 1);
      dots[i].show(show);
      if (show) dots[i].set(p);
      const lab = show ? m.labels[i] || "" : "";
      labels[i].show(Boolean(lab));
      if (lab) {
        const right = i % 2 === 0;
        labels[i].set(p, lab, right ? 9 : -18, i === 0 || i === 1 ? 17 : -7);
      }
    }
    apexArc.show(true);
    apexArc.set(A, B, Cc, 24);
    angleLabel.show(true);
    angleLabel.set(A, `${Math.round(m.measuredAngle)}°`);

    setTicks(0, B, Cc, 2);
    if (m.D) setTicks(1, B, m.D, 2); else setTicks(1, B, B, 0);
    if (m.E) setTicks(2, B, m.E, 1); else setTicks(2, B, B, 0);
    if (m.D && m.E) setTicks(3, m.D, m.E, 1); else setTicks(3, B, B, 0);
    if (m.E && m.F && Core.distance(m.E, m.F) > 2) setTicks(4, m.E, m.F, 1);
    else setTicks(4, B, B, 0);
    if (m.F) setTicks(5, A, m.F, 1); else setTicks(5, B, B, 0);

    say(describe(m), null);
    if (window.Track) window.Track.state(state);
  }

  /* A drag changes the angle; refuse one that leaves the applet's range. */
  function clampVertex(p, name) {
    const next = Core.withPoint(state, name, p);
    const a = Core.angleOf(next);
    return a >= 20 && a <= 80 ? p : state[name];
  }
  function moveVertex(name, p) {
    state = Core.withPoint(state, name, p);
    render();
  }
  const handleOpts = (name) => ({
    r: 9, step: 2, shift: 10, layer: handlesLayer,
    label: `Corner ${name}. Drag it, or focus it and use the arrow keys to change the apex angle.`,
    describe: () => `The apex angle is now ${Math.round(Core.angleOf(state))} degrees.`,
    clamp: (p, which) => clampVertex(p, which),
    onMove: (p, which) => moveVertex(which, p),
  });
  board.handle("A", state.A, handleOpts("A"));
  board.handle("B", state.B, handleOpts("B"));
  board.handle("C", state.C, handleOpts("C"));

  angleInput.addEventListener("input", () => {
    state = Core.withAngle(state, Number(angleInput.value));
    render();
  });
  newBtn.addEventListener("click", () => {
    state = Core.start({ angle: 45 });
    render();
  });
  goldenBtn.addEventListener("click", () => {
    state = Core.withAngle(state, 36);
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") {
      state = Core.start({ angle: 45 });
      render();
    }
  });

  board.onTheme(render);
  render();
})();
