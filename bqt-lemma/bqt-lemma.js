"use strict";

/*
 * The page for BQTLemma: drawing and input only; the geometry is in
 * bqt-lemma-core.js. The SVG holds a line with A, B, C on it and two points D,
 * E off it; the core rebuilds E when D (or A, or B) moves and D when E (or C)
 * moves, so the two pairs of lines stay parallel. F is the midpoint of AC.
 * The shaded triangles are DEM, ABD and BCE; the status compares their areas.
 */

(function () {
  const Core = BqtLemmaCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const extraBtn = document.getElementById("extraBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const onBase = (p) => Core.pointOnAC(state.A, state.C,
    Core.parameterOnAC(state.A, state.C, inside(p)));
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(1) : "—");

  let state = Core.start();
  let showNames = false;
  let showExtra = false;
  let checked = false;

  const fills = board.layer("fills");
  const lines = board.layer("lines");
  const guides = board.layer("guides");
  const marks = board.layer("marks");
  const labels = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Every object is made once; render only changes its geometry and visibility. */
  const fillDem = board.polygon([state.D, state.E, state.A], "fill-dem", fills);
  const fillAbd = board.polygon([state.A, state.B, state.D], "fill-pair", fills);
  const fillBce = board.polygon([state.B, state.C, state.E], "fill-pair", fills);

  const base = board.segment(state.A, state.C, "base-line", lines);
  const sides = [
    board.segment(state.A, state.D, "edge", lines),
    board.segment(state.B, state.D, "edge", lines),
    board.segment(state.C, state.E, "edge", lines),
    board.segment(state.B, state.E, "edge", lines),
    board.segment(state.D, state.E, "de-line", lines),
  ];
  const medianA = board.segment(state.A, state.E, "extra-line", guides);
  const medianC = board.segment(state.C, state.D, "extra-line", guides);
  const halfDE = [
    board.segment(state.A, state.A, "half-line", guides),
    board.segment(state.C, state.C, "half-line", guides),
  ];
  const fDot = board.point(state.A, "mid-dot", 4, marks);
  const names = ["A", "B", "C", "D", "E"].map((t) =>
    board.label(state.A, t, "glabel", -14, -9, labels));
  const fName = board.label(state.A, "F", "glabel f-label", 8, -8, labels);

  /** Shows a line under the board. The record reads .done on a checked claim. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const F = m.F;
    state.F = F;

    fillDem.set([state.D, state.E, F]);
    fillAbd.set([state.A, state.B, state.D]);
    fillBce.set([state.B, state.C, state.E]);
    base.set(state.A, state.C);
    sides[0].set(state.A, state.D);
    sides[1].set(state.B, state.D);
    sides[2].set(state.C, state.E);
    sides[3].set(state.B, state.E);
    sides[4].set(state.D, state.E);

    medianA.show(showExtra);
    medianC.show(showExtra);
    if (showExtra) {
      medianA.set(state.A, state.E);
      medianC.set(state.C, state.D);
    }
    halfDE[0].set(F, state.D);
    halfDE[1].set(F, state.E);

    fDot.set(F);
    for (let i = 0; i < names.length; i++) {
      const p = [state.A, state.B, state.C, state.D, state.E][i];
      names[i].set(p);
      names[i].show(showNames);
    }
    /* The applet only prints F when B is far enough away not to cover it. */
    fName.set(F);
    fName.show(showNames && Geom.distance(state.B, F) > 10);

    for (const name of ["A", "B", "C", "D", "E"]) handles[name].set(state[name]);

    if (!m.valid) {
      say("Move the points apart until the parallel lines meet again.", null);
    } else {
      const line = `DEM = ${fmt(m.areas.DEM)}, (ABD + BCE)/2 = ${fmt(m.halfSum)}.`;
      if (checked) say(`${line} The two numbers are equal.`, "done");
      else say(`${line} Drag a point, or press Check the claim.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function move(name, p) {
    state = Core.withPoint(state, name, p);
    checked = false;
    render();
  }

  const clampFree = (p) => inside(p);
  const handles = {
    A: board.handle("A", state.A, {
      r: 8, step: 4, shift: 12, layer: handlesLayer, clamp: clampFree,
      label: "Point A on the base line. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("A", p),
    }),
    B: board.handle("B", state.B, {
      r: 8, step: 4, shift: 12, layer: handlesLayer, clamp: onBase,
      label: "Point B on the base line. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("B", p),
    }),
    C: board.handle("C", state.C, {
      r: 8, step: 4, shift: 12, layer: handlesLayer, clamp: clampFree,
      label: "Point C on the base line. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("C", p),
    }),
    D: board.handle("D", state.D, {
      r: 8, step: 4, shift: 12, layer: handlesLayer, clamp: clampFree,
      label: "Point D above the base line. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("D", p),
    }),
    E: board.handle("E", state.E, {
      r: 8, step: 4, shift: 12, layer: handlesLayer, clamp: clampFree,
      label: "Point E above the base line. Drag, or focus and use the arrow keys to move it.",
      describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
      onMove: (p) => move("E", p),
    }),
  };

  function reset() {
    state = Core.start();
    checked = false;
    render();
    handles.A.node.focus();
  }

  function toggleNames() {
    showNames = !showNames;
    namesBtn.setAttribute("aria-pressed", String(showNames));
    namesBtn.textContent = showNames ? "Hide names" : "Show names";
    render();
  }

  function toggleExtra() {
    showExtra = !showExtra;
    extraBtn.setAttribute("aria-pressed", String(showExtra));
    extraBtn.textContent = showExtra ? "Hide extra lines" : "Show extra lines";
    render();
  }

  function checkClaim() {
    const cl = Core.claims(state);
    checked = Boolean(cl) && Object.values(cl).every(Boolean);
    render();
    if (!checked) say("Move the points apart and clear the parallel lines, then check again.", null);
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", toggleNames);
  extraBtn.addEventListener("click", toggleExtra);
  checkBtn.addEventListener("click", checkClaim);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "r") reset();
    if (key === "n") toggleNames();
    if (key === "e") toggleExtra();
    if (key === "c") checkClaim();
  });

  board.onTheme(render);
  render();
})();
