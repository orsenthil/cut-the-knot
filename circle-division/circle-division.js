"use strict";

/*
 * The page for Circle Division: drawing and input only. The geometry lives in
 * circle-division-core.js, which follows Compute() in CircleDivisionCanvas.
 * A and C are the applet's two draggable points on the circle; E is the midpoint
 * of the shorter arc AC, B is on the line through D parallel to AC, and Z is on
 * the line through E parallel to BC. The two chords EZ and BC cut off a band
 * whose area is the same fraction of the circle as the arc AC is of a turn.
 */

(function () {
  const Core = CircleDivisionCore;
  const O = { x: Core.CX, y: Core.CY };
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("namesBox");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();
  let last = Core.construct(state);

  /** The line under the board. "done" is how a demo tells the record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  // Paint order: the shaded band, the circle and guides, the four chords,
  // the construction dots, the names, then the two draggable handles.
  const bands = board.layer("bands");
  const guides = board.layer("guides");
  const chords = board.layer("chords");
  const hints = board.layer("hints");
  const dots = board.layer("dots");
  const labels = board.layer("labels");
  const handleLayer = board.layer("handles");

  const band = board.el("path", null, "band", bands);
  const circle = board.circle(O, Core.R, "circle", guides);
  const lineBD = board.line(O, O, "guide", guides);
  const lineAC = board.line(O, O, "guide", guides);
  const chordBC = board.line(O, O, "chord-bc", chords);
  const chordEZ = board.line(O, O, "chord-ez", chords);
  const hintDE = board.line(O, O, "hint-line", hints);
  const hintDB = board.line(O, O, "hint-line", hints);
  const arcEA = board.arc(O, Core.R, 0, 0, "hint-arc", hints);
  const arcZB = board.arc(O, Core.R, 0, 0, "hint-arc", hints);
  const dotM = board.point(O, "mark", 3.2, dots);
  const dotE = board.point(O, "construct-dot", 4, dots);
  const dotB = board.point(O, "construct-dot", 4, dots);
  const dotZ = board.point(O, "construct-dot", 4, dots);
  const dotK = board.point(O, "cross-dot", 4, dots);

  const labelA = board.label(O, "A", "pt-label", -14, -9, labels);
  const labelB = board.label(O, "B", "pt-label", 8, 16, labels);
  const labelC = board.label(O, "C", "pt-label", -14, 17, labels);
  const labelD = board.label(O, "D", "pt-label", 7, -7, labels);
  const labelE = board.label(O, "E", "pt-label", -16, -7, labels);
  const labelZ = board.label(O, "Z", "pt-label", 7, -8, labels);
  const labelK = board.label(O, "K", "pt-label", 8, -7, labels);

  /** A filled band Z-B-C-E: two circle arcs joined by the two parallel chords. */
  function bandPath(g) {
    const angle = (p) => Math.atan2(p.y - O.y, p.x - O.x);
    const sweep = (from, to) => Math.atan2(Math.sin(to - from), Math.cos(to - from));
    const arcPoints = (from, to) => {
      const d = sweep(from, to);
      return Array.from({ length: 21 }, (_, i) => {
        const t = from + (d * i) / 20;
        return { x: O.x + Core.R * Math.cos(t), y: O.y + Core.R * Math.sin(t) };
      });
    };
    const pts = [g.E, ...arcPoints(angle(g.E), angle(g.C)).slice(1),
      g.B, ...arcPoints(angle(g.B), angle(g.Z)).slice(1), g.Z];
    return "M " + pts.map((p) => `${p.x} ${p.y}`).join(" L ") + " Z";
  }

  const clamp = (q) => Core.project(q) || q;
  const describe = (p) => `at ${Math.round((Math.atan2(p.y - O.y, p.x - O.x) * 180 / Math.PI + 360) % 360)} degrees on the circle`;
  const labelFor = (name) =>
    `Point ${name}. Drag it, or focus it and use the arrow keys to move it around the circle.`;
  const onMove = (p, name) => apply({ type: "point", name, x: p.x, y: p.y });
  const A = board.handle("A", state.A,
    { r: 9, step: 3, shift: 12, label: labelFor("A"), describe, clamp, onMove, layer: handleLayer });
  const Cc = board.handle("C", state.C,
    { r: 9, step: 3, shift: 12, label: labelFor("C"), describe, clamp, onMove, layer: handleLayer });

  function statusText(g) {
    const pct = (g.fraction * 100).toFixed(1);
    const simple = [[1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [2, 3]];
    const hit = simple.find(([n, d]) => Math.abs(g.fraction - n / d) < 0.002);
    const exact = hit ? `, exactly ${hit[0]}/${hit[1]}` : "";
    return `Arc AC is ${g.arcDegrees.toFixed(0)} degrees. The two parallel chords cut off ${pct}%${exact} of the circle.`;
  }

  function render(note) {
    const g = Core.construct(state);
    if (g) {
      last = g;
      band.setAttribute("d", bandPath(g));
      circle.set(O, Core.R);
      lineBD.set(g.D, g.B);
      lineAC.set(g.A, g.C);
      chordBC.set(g.B, g.C);
      chordEZ.set(g.E, g.Z);
      hintDE.set(g.D, g.E);
      hintDB.set(g.D, g.B);
      arcEA.set(O, Core.R, Math.atan2(g.E.y - O.y, g.E.x - O.x), Math.atan2(g.A.y - O.y, g.A.x - O.x));
      arcZB.set(O, Core.R, Math.atan2(g.Z.y - O.y, g.Z.x - O.x), Math.atan2(g.B.y - O.y, g.B.x - O.x));
      dotM.set(g.M);
      dotE.set(g.E);
      dotB.set(g.B);
      dotZ.set(g.Z);
      if (g.K) dotK.set(g.K);
      labelA.set(g.A);
      labelB.set(g.B);
      labelC.set(g.C);
      labelD.set(g.D);
      labelE.set(g.E);
      labelZ.set(g.Z);
      labelK.set(g.K || O);
      A.set(g.A);
      Cc.set(g.C);
    }
    const shown = g || last;
    const showHint = state.hint && !!g;
    [hintDE, hintDB, arcEA, arcZB].forEach((s) => s.show(showHint));
    dotM.show(showHint);
    dotK.show(showHint && !!shown.K);
    labelK.show(showHint && state.names && !!shown.K);
    [dotE, dotB, dotZ].forEach((s) => s.show(!!g));
    [labelB, labelE, labelZ].forEach((s) => s.show(state.names && !!g));
    labelD.show(state.names);
    labelA.show(true);
    labelC.show(true);

    namesBox.checked = state.names;
    hintBox.checked = state.hint;
    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        A: state.A, C: state.C, D: O,
        E: shown && shown.E, B: shown && shown.B, Z: shown && shown.Z,
        arcDegrees: shown && shown.arcDegrees, fraction: shown && shown.fraction,
        names: state.names, hint: state.hint,
      });
    }
    say(note || (g ? statusText(g) : "Move A and C apart to see the construction."), Core.result(state));
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render(note);
    return true;
  }

  namesBox.addEventListener("change", () => apply({ type: "names", value: namesBox.checked }));
  hintBox.addEventListener("change", () => apply({ type: "hint", value: hintBox.checked }));
  resetBtn.addEventListener("click", () => {
    apply({ type: "reset" });
    say("Back to the opening picture.", Core.result(state));
  });
  // Colours come from CSS tokens, but redraw on a theme flip all the same.
  board.onTheme(() => render());

  render();
})();
