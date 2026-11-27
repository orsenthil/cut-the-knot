"use strict";

/*
 * The page for External Angle Bisector: drawing and input only; the geometry
 * is in external-angle-bisector-core.js. The SVG holds a triangle with three
 * draggable corners, the bisector of the angle outside A (red), the extra
 * construction with E on line AB, and the equal-angle and equal-length marks.
 * A, B and C are keyboard-accessible handles; every option is a real button.
 */

(function () {
  const Core = ExternalAngleBisectorCore;
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
  const bisector = board.line(state.A, state.B, "bisector", shapes);
  const footSegs = [
    board.line(state.B, state.C, "foot-line", shapes),
    board.line(state.C, state.A, "foot-line", shapes),
  ];
  const extraAE = board.line(state.A, state.B, "extra-line", shapes);
  const extraCE = board.line(state.C, state.A, "extra-line", shapes);
  const outerArcs = [
    board.angleArc(state.A, state.B, state.C, 30, "half-arc", marks),
    board.angleArc(state.A, state.C, state.B, 30, "half-arc alt", marks),
  ];
  const isoArcs = [
    board.angleArc(state.A, state.B, state.C, 20, "iso-arc", marks),
    board.angleArc(state.C, state.A, state.B, 20, "iso-arc alt", marks),
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
  for (let i = 0; i < 80; i++) hintLines.push(board.line(state.A, state.B, "hint-line", hintLayer));

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

    if (m.degenerate || !m.E) {
      bisector.show(false);
      footSegs.forEach((s) => s.show(false));
      extraAE.show(false);
      extraCE.show(false);
      dDot.show(false);
      eDot.show(false);
      outerArcs.forEach((a) => a.show(false));
      isoArcs.forEach((a) => a.show(false));
      labels[3].show(false);
      labels[4].show(false);
      hintLines.forEach((line) => line.show(false));
      say("Move the corners apart to make a triangle.", null);
    } else {
      // The red line is the outside bisector; when the foot is beyond the
      // applet's guard it is the line through A parallel to BC.
      bisector.show(true);
      bisector.set(A, m.D || { x: A.x + m.direction.x * 100, y: A.y + m.direction.y * 100 });

      footSegs.forEach((line, i) => {
        line.show(Boolean(m.D));
        if (m.D) line.set(i === 0 ? B : Cc, m.D);
      });
      dDot.show(Boolean(m.D));
      if (m.D) dDot.set(m.D);
      labels[3].show(Boolean(m.D) && m.showNames);
      if (m.D) labels[3].set(m.D);

      // The two arcs at A are the equal halves of the external angle: one
      // ends at the chosen corner, the other at its mirror in the bisector.
      outerArcs[0].show(true);
      outerArcs[1].show(true);
      outerArcs[0].set(A, m.chosen, m.bisPoint, 30);
      outerArcs[1].set(A, m.reflected, m.bisPoint, 30);

      const hasExtra = m.extra && Boolean(m.E);
      extraAE.show(hasExtra);
      extraCE.show(hasExtra);
      eDot.show(hasExtra);
      labels[4].show(hasExtra && m.showNames);
      isoArcs.forEach((a) => a.show(hasExtra));
      if (hasExtra) {
        extraAE.set(A, m.E);
        extraCE.set(Cc, m.E);
        eDot.set(m.E);
        labels[4].set(m.E);
        isoArcs[0].set(m.E, A, Cc, 20);
        isoArcs[1].set(Cc, m.E, A, 20);
      }

      // The applet's Hint: lines parallel to AD from one side to the other.
      const segments = m.hint ? Core.hintSegments(state, m) : [];
      segments.forEach(([p, q], i) => {
        hintLines[i].show(true);
        hintLines[i].set(p, q);
      });
      for (let i = segments.length; i < hintLines.length; i++) hintLines[i].show(false);

      if (checked) {
        const ok = Core.claims(state);
        const holds = Object.keys(ok).every((k) => k === "printedAngle" || ok[k]);
        say(holds
          ? `AB/AC = DB/DC = ${fmt(m.ratios.AB_AC)}. AE = AC = ${fmt(m.sides.b)} — the page's ratio holds.`
          : "Move the corners apart, then check again.", holds ? "done" : null);
      } else {
        say(`AB/AC = ${fmt(m.ratios.AB_AC)} and DB/DC = ${fmt(m.ratios.externalDB_DC)}. Drag a corner, then check the ratio.`);
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

  const opts = {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
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

  function checkRatio() {
    checked = true;
    render();
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
