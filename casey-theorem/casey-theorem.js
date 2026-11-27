"use strict";

/*
 * The page for Casey's theorem: drawing and input only; the geometry is in
 * casey-theorem-core.js. Four draggable centres carry the circles; the six
 * common tangents are drawn between their tangency points. Red tangents join
 * circles touching the big circle on the same side, blue ones cross between
 * sides - exactly the applet's colour choice.
 */

(function () {
  const Core = CaseyTheoremCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : "—");

  let state = Core.start();
  let checked = false;
  let showNames = true;

  const shapes = board.layer("shapes");
  const tangentLayer = board.layer("tangents");
  const marks = board.layer("marks");
  const handleLayer = board.layer("handles");

  /* Every object is made once and only its geometry changes on a redraw, so
   * keyboard focus stays on the handle the player is moving. */
  const bigCircle = board.circle(state.S, state.R, "big-circle", shapes);
  const smallCircles = state.points.map((p) => board.circle(p, 1, "small-circle", shapes));
  const tangents = Core.PAIRS.map(() => board.segment(state.S, state.S, "tangent-segment", tangentLayer));
  const handles = [];
  const labels = state.points.map((p, i) =>
    board.label(p, "ABCD"[i], "glabel", i === 2 ? -18 : -16, i === 1 || i === 2 ? -10 : 22, marks));

  /** Shows a line under the picture. "done" tells the record a check finished. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    bigCircle.set(state.S, state.R);

    for (let i = 0; i < 4; i++) {
      const c = m.circles[i];
      smallCircles[i].set(c.center, Math.max(c.radius, 0.01));
      labels[i].set(c.center);
      labels[i].show(showNames);
      if (handles[i]) handles[i].set(c.center);
    }

    for (let i = 0; i < tangents.length; i++) {
      const t = m.tangents[i];
      const seg = tangents[i];
      seg.show(Boolean(t.segment));
      if (!t.segment) continue;
      seg.set(t.segment.p, t.segment.q);
      seg.node.setAttribute("class", t.external ? "tangent-segment tangent-out" : "tangent-segment tangent-in");
      seg.node.setAttribute("aria-label",
        `Common ${t.external ? "outer" : "inner"} tangent of circles ${"ABCD"[t.i]} and ${"ABCD"[t.j]}, length ${fmt(t.length)}`);
    }

    const cl = Core.claims(state);
    const outside = m.circles.filter((c) => c.inside).length;
    if (!cl.tangentsExist) {
      say("Move the points apart so every pair of circles has a common tangent.", null);
    } else if (checked) {
      if (cl.caseyIdentity) {
        const len = (i, j) => {
          const t = m.tangents.find((x) => (x.i === i && x.j === j) || (x.i === j && x.j === i));
          return t && t.length !== null ? fmt(t.length) : "—";
        };
        say(`Casey's identity holds: ${len(0, 1)}×${len(2, 3)} + ${len(0, 3)}×${len(1, 2)} = ` +
          `${len(0, 2)}×${len(1, 3)} = ${fmt(m.right)}.`, "done");
      } else {
        say(`The identity fails here (${fmt(m.left)} against ${fmt(m.right)}): put A, B, C, D back in order around the circle.`, null);
      }
    } else {
      say(`${outside} of the 4 circles lie outside the big one. Purple segments are outer tangents, dashed red ones are inner tangents. Drag a point, or press Check the identity.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  "ABCD".split("").forEach((name, i) => {
    handles[i] = board.handle(name, state.points[i], {
      r: 9, step: 3, shift: 12, layer: handleLayer,
      clamp: inside,
      label: `Point ${name}. Drag it, or focus it and use the arrow keys to move its circle.`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => movePoint(name, p),
    });
  });

  function reset() {
    state = Core.start();
    checked = false;
    render();
    handles[0].node.focus();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function checkIdentity() {
    checked = true;
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  checkBtn.addEventListener("click", checkIdentity);
  document.addEventListener("keydown", (e) => {
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "n" || e.key === "N") toggleNames();
    if (e.key === "c" || e.key === "C") checkIdentity();
  });

  board.onTheme(render);
  render();
})();
