"use strict";

/*
 * The page for Cross Points in a Polygon: drawing and input only; the
 * mathematics is in ceva-in-ngon-core.js. An SVG holds an odd-sided polygon,
 * a point P and, for each vertex, the whole line through P and that vertex.
 * Only the cross points that really land on the opposite side are marked.
 * P and every vertex can be dragged or moved with the arrow keys.
 */

(function () {
  const Core = CevaInNgonCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nOut = document.getElementById("nOut");
  const nMinus = document.getElementById("nMinus");
  const nPlus = document.getElementById("nPlus");
  const newBtn = document.getElementById("newBtn");
  const checkBtn = document.getElementById("checkBtn");

  const MAX_V = Core.MAX_N;
  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");

  let state = Core.start();
  let checked = false;

  /* Objects are made once and only their geometry changes on a redraw, so a
   * handle keeps keyboard focus when the picture is updated. */
  const polygonLayer = board.layer("polygon");
  const lineLayer = board.layer("lines");
  const crossLayer = board.layer("crosses");
  const labelLayer = board.layer("labels");
  const handleLayer = board.layer("handles");

  const polygon = board.polygon(state.vertices, "polygon-edge", polygonLayer);
  const cevians = [], crosses = [], labels = [];
  for (let i = 0; i < MAX_V; i++) {
    cevians.push(board.line(state.p, state.p, "cevian", lineLayer));
    crosses.push(board.point(state.p, "cross-dot", 5, crossLayer));
    labels.push(board.label(state.p, "A" + i, "vlabel", -14, -10, labelLayer));
  }
  const pLabel = board.label(state.p, "P", "plabel", 10, -10, labelLayer);

  /**
   * Shows the line under the picture. `kind` is "done" when a claim has been
   * checked; the shared record reads that class. This illustration has no
   * win or loss, so "win" and "lose" are never used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.compute(state);
    const cl = Core.claims(state);
    polygon.set(state.vertices);
    nOut.textContent = String(state.n);
    nMinus.disabled = state.n <= Core.MIN_N;
    nPlus.disabled = state.n >= Core.MAX_N;

    for (let i = 0; i < MAX_V; i++) {
      const active = i < state.n;
      cevians[i].show(active);
      crosses[i].show(active && m.isInside[i]);
      labels[i].show(active && state.n <= 9);
      if (!active) continue;
      cevians[i].set(state.p, state.vertices[i]);
      if (m.isInside[i] && m.cross[i]) crosses[i].set(m.cross[i]);
      labels[i].set(state.vertices[i]);
    }
    pLabel.set(state.p);
    hP.set(state.p);
    for (let i = 0; i < MAX_V; i++) {
      hV[i].show(i < state.n);
      if (i < state.n) hV[i].set(state.vertices[i]);
    }

    const dots = `${cl ? cl.count : 0} cross point${cl && cl.count === 1 ? "" : "s"} on the sides`;
    if (!cl) {
      say("Two of the lines are parallel or two points coincide, so a cross point is missing. Move P or a corner.", null);
    } else if (checked) {
      say(`${state.n} sides, ${dots}, product ${fmt(cl.product)}. Both claims hold: the count is odd and the product is 1.`, "done");
    } else {
      say(`${state.n} sides, ${dots}, product ${fmt(cl.product)}. Drag a point, or press Check the claims.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(p, name) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampPoint = (p) => inside(p);
  const hP = board.handle("P", state.p, {
    r: 9, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
    label: "Point P. Drag it anywhere, or focus it and use the arrow keys to move it",
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p, name) => movePoint(p, name),
  });
  const hV = [];
  for (let i = 0; i < MAX_V; i++) {
    hV.push(board.handle("V" + i, state.vertices[i] || state.p, {
      r: 8, step: 4, shift: 16, layer: handleLayer, clamp: clampPoint,
      label: `Vertex A${i}. Drag it, or focus it and use the arrow keys to move it`,
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p, name) => movePoint(p, name),
    }));
  }

  function changeN(delta) {
    state = Core.withN(state, state.n + delta);
    checked = false;
    render();
  }

  function newPicture() {
    state = Core.start({ n: state.n });
    checked = false;
    render();
  }

  function checkClaims() {
    checked = Boolean(Core.claims(state));
    render();
    if (!checked) say("Move a point so that every cross point exists, then check again.", null);
  }

  nMinus.addEventListener("click", () => changeN(-2));
  nPlus.addEventListener("click", () => changeN(2));
  newBtn.addEventListener("click", newPicture);
  checkBtn.addEventListener("click", checkClaims);
  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "r" || e.key === "R") newPicture();
    if (e.key === "c" || e.key === "C") checkClaims();
  });

  board.onTheme(render);
  render();
})();
