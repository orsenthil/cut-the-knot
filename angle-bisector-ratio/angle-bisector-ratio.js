"use strict";

/*
 * The page for Angle Bisector Ratio: drawing and input only; the mathematics
 * is in angle-bisector-ratio-core.js. An SVG holds a triangle with three
 * draggable corners, the bisector from A, its foot D on BC, and — when the
 * extra construction is on — the point E where the parallel through C meets
 * line AB. The two small arcs at A show the equal halves; with the extra
 * construction the arcs at E and C show the isosceles triangle AEC.
 */

(function () {
  const Core = AngleBisectorRatioCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const hintBtn = document.getElementById("hintBtn");
  const extraBtn = document.getElementById("extraBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 10, view.x + view.width - 10),
    y: Geom.clamp(p.y, view.y + 10, view.y + view.height - 10),
  });
  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : "—");
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });

  let state = Core.start();
  let checked = false;

  const hintLayer = board.layer("hint");
  const shapes = board.layer("shapes");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  /* Every object is made once; render only moves and shows or hides it. */
  const sides = [
    board.segment(state.A, state.B, "tri-side", shapes),
    board.segment(state.B, state.C, "tri-side", shapes),
    board.segment(state.C, state.A, "tri-side", shapes),
  ];
  const bisector = board.segment(state.A, state.B, "bisector", shapes);
  const extraCE = board.segment(state.C, state.A, "extra-line", shapes);
  const extraAE = board.segment(state.A, state.B, "extra-line", shapes);
  const halfArcs = [
    board.angleArc(state.A, state.B, state.C, 27, "half-arc", marks),
    board.angleArc(state.A, state.C, state.B, 27, "half-arc alt", marks),
  ];
  const isoArcs = [
    board.angleArc(state.A, state.B, state.C, 22, "iso-arc", marks),
    board.angleArc(state.C, state.A, state.B, 22, "iso-arc alt", marks),
  ];
  const dDot = board.point(state.A, "foot-dot", 4.5, marks);
  const eDot = board.point(state.A, "extra-dot", 4.5, marks);
  const labels = [
    board.label(state.A, "A", "glabel", -18, 24, marks),
    board.label(state.B, "B", "glabel", -18, 24, marks),
    board.label(state.C, "C", "glabel", -18, -10, marks),
    board.label(state.A, "D", "glabel foot-label", 8, -8, marks),
    board.label(state.A, "E", "glabel extra-label", -18, -10, marks),
  ];
  const hintLines = [];
  for (let i = 0; i < 50; i++) hintLines.push(board.line(state.A, state.B, "hint-line", hintLayer));

  /**
   * Shows the line under the diagram. "done" is the class the player's record
   * reads when an illustration has been explored; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const m = Core.measurements(state);
    const A = state.A, B = state.B, Cc = state.C;

    sides[0].set(A, B);
    sides[1].set(B, Cc);
    sides[2].set(Cc, A);

    if (m.degenerate || !m.D) {
      bisector.show(false);
      extraCE.show(false);
      extraAE.show(false);
      dDot.show(false);
      eDot.show(false);
      halfArcs.forEach((a) => a.show(false));
      isoArcs.forEach((a) => a.show(false));
      labels[3].show(false);
      labels[4].show(false);
      hintLines.forEach((line) => line.show(false));
      say("Move the corners apart to make a triangle.", null);
    } else {
      const D = m.D, E = m.E;
      bisector.show(true);
      bisector.set(A, D);
      dDot.show(true);
      dDot.set(D);
      labels[3].show(m.showNames);
      labels[3].set(D);

      halfArcs[0].show(true);
      halfArcs[1].show(true);
      halfArcs[0].set(A, B, D, 27);
      halfArcs[1].set(A, D, Cc, 27);

      const hasExtra = m.extra && Boolean(E);
      extraCE.show(hasExtra);
      extraAE.show(hasExtra);
      eDot.show(hasExtra);
      labels[4].show(hasExtra && m.showNames);
      isoArcs.forEach((a) => a.show(hasExtra));
      if (hasExtra) {
        extraCE.set(Cc, E);
        extraAE.set(A, E);
        eDot.set(E);
        labels[4].set(E);
        isoArcs[0].set(E, A, Cc, 22);
        isoArcs[1].set(Cc, E, A, 22);
      }

      // The applet's Hint: cut AE and AB into equal steps (20 to a step) and
      // join corresponding points to the parallel copies on DC and DB.
      let used = 0;
      if (m.hint) {
        const stepsAE = Math.trunc(Core.distance(A, E) / 20);
        const stepsAB = Math.trunc(Core.distance(A, B) / 20);
        for (let i = 1; i <= stepsAE && used < hintLines.length; i++) {
          const t = i / stepsAE;
          const p = hasExtra ? lerp(A, E, t) : lerp(A, Cc, t);
          hintLines[used].show(true);
          hintLines[used++].set(p, lerp(D, Cc, t));
        }
        for (let j = 1; j <= stepsAB && used < hintLines.length; j++) {
          const t = j / stepsAB;
          hintLines[used].show(true);
          hintLines[used++].set(lerp(A, B, t), lerp(D, B, t));
        }
      }
      for (let i = used; i < hintLines.length; i++) hintLines[i].show(false);

      if (checked) {
        say(`AB/AC = ${fmt(m.ratios.AB_AC)} and DB/DC = ${fmt(m.ratios.DB_DC)} — the same number. AE = AC too.`, "done");
      } else {
        say(`AB/AC = ${fmt(m.ratios.AB_AC)} and DB/DC = ${fmt(m.ratios.DB_DC)}. Drag a corner, then press Check the ratio.`, null);
      }
    }

    labels[0].show(m.showNames);
    labels[1].show(m.showNames);
    labels[2].show(m.showNames);
    labels[0].set(A);
    labels[1].set(B);
    labels[2].set(Cc);

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function moveVertex(name, p) {
    state = Core.withPoint(state, name, inside(p));
    checked = false;
    render();
  }

  const clampVertex = (p) => inside(p);
  const opts = {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: clampVertex,
    describe: (p) => `at ${Math.round(p.x)}, ${Math.round(p.y)}`,
  };
  const hA = board.handle("A", state.A, {
    ...opts,
    label: "Corner A. Drag, or focus and use the arrow keys to move it.",
    onMove: (p) => moveVertex("A", p),
  });
  const hB = board.handle("B", state.B, {
    ...opts,
    label: "Corner B. Drag, or focus and use the arrow keys to move it.",
    onMove: (p) => moveVertex("B", p),
  });
  const hC = board.handle("C", state.C, {
    ...opts,
    label: "Corner C. Drag, or focus and use the arrow keys to move it.",
    onMove: (p) => moveVertex("C", p),
  });

  function syncButtons() {
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    hintBtn.setAttribute("aria-pressed", String(state.hint));
    hintBtn.textContent = state.hint ? "Hide hint" : "Show hint";
    extraBtn.setAttribute("aria-pressed", String(state.extra));
    extraBtn.textContent = state.extra ? "Hide construction" : "Extra construction";
  }

  function reset() {
    const fresh = Core.start();
    state = {
      ...fresh,
      showNames: state.showNames, hint: state.hint, extra: state.extra,
    };
    checked = false;
    hA.set(state.A);
    hB.set(state.B);
    hC.set(state.C);
    syncButtons();
    render();
    hA.node.focus();
  }

  function toggle(name) {
    state = Core.withOption(state, name, !state[name]);
    syncButtons();
    render();
  }

  const claimsPass = (cl) => Object.values(cl).every(Boolean);
  function checkRatio() {
    const cl = Core.claims(state);
    checked = claimsPass(cl);
    render();
    if (!checked) say("Move the corners apart, then check again.", null);
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("showNames"));
  hintBtn.addEventListener("click", () => toggle("hint"));
  extraBtn.addEventListener("click", () => toggle("extra"));
  checkBtn.addEventListener("click", checkRatio);
  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === "r") reset();
    else if (k === "n") toggle("showNames");
    else if (k === "h") toggle("hint");
    else if (k === "e") toggle("extra");
    else if (k === "c") checkRatio();
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
