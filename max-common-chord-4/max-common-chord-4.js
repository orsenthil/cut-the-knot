"use strict";

/*
 * The page for Two Circles and One More: drawing and input only. All geometry
 * is in max-common-chord-4-core.js. The stage holds the two given circles, the
 * four draggable points P, Q, A and B, and the constructed points L, M, G, H
 * and the two centres. The four checkboxes correspond to the applet's
 * "show statement 1", "show statement 2", "show hint" and "show names".
 */

(function () {
  const Core = MaxCommonChord4Core;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("newBtn");

  let state = Core.start({});
  let figure = Core.compute(state);

  /** The line under the picture. An illustration has no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers are created in paint order, as in the applet: guides first, then
     the optional statements, the circles, the dots, labels and handles. */
  const guides = board.layer("guides");
  const statements = board.layer("statements");
  const circles = board.layer("circles");
  const hints = board.layer("hints");
  const dots = board.layer("dots");
  const names = board.layer("names");
  const tops = board.layer("handles");

  const guideGM = board.line(figure.G, figure.M, "guide-line", guides);
  const guideHL = board.line(figure.H, figure.L, "guide-line", guides);
  const circleO = board.circle(figure.O, figure.O.r, "circle-extra", statements);
  const chordQL = board.segment(figure.Q, figure.L, "statement-line", statements);
  const chordQM = board.segment(figure.Q, figure.M, "statement-line", statements);
  const chordPQ = board.segment(figure.P, figure.Q, "statement-line", statements);
  const arcQ = board.angleArc(figure.Q, figure.L, figure.M, 22, "arc-q", statements);

  const hintLines = [
    board.segment(figure.E, figure.L, "hint-line", hints),
    board.segment(figure.E, figure.P, "hint-line", hints),
    board.segment(figure.F, figure.M, "hint-line", hints),
    board.segment(figure.F, figure.P, "hint-line", hints),
    board.segment(figure.L, figure.P, "hint-line", hints),
    board.segment(figure.M, figure.P, "hint-line", hints),
  ];
  const apexE = board.angleArc(figure.E, figure.L, figure.P, 16, "arc-hint", hints);
  const apexF = board.angleArc(figure.F, figure.M, figure.P, 16, "arc-hint", hints);
  const baseL = board.angleArc(figure.L, figure.E, figure.P, 13, "arc-hint", hints);
  const baseM = board.angleArc(figure.M, figure.P, figure.F, 13, "arc-hint", hints);
  const ticks = [
    board.segment(figure.E, figure.P, "tick", hints),
    board.segment(figure.E, figure.L, "tick", hints),
    board.segment(figure.F, figure.P, "tick", hints),
    board.segment(figure.F, figure.M, "tick", hints),
  ];

  const circleE = board.circle(figure.E, figure.E.r, "circle-main", circles);
  const circleF = board.circle(figure.F, figure.F.r, "circle-main", circles);

  const dotKeys = ["L", "M", "E", "F", "G", "H"];
  const dotsByKey = {};
  dotKeys.forEach((key) => { dotsByKey[key] = board.point(figure[key], "derived-dot", 4, dots); });

  const labelOffsets = { P: [9, -8], Q: [9, 19], E: [-19, -8], F: [7, -8],
    L: [-18, -9], M: [7, -9], G: [-19, 19], H: [7, 19] };
  const labels = {};
  Object.keys(labelOffsets).forEach((key) => {
    const off = labelOffsets[key];
    labels[key] = board.label(figure[key] || state[key], key, "pt-label", off[0], off[1], names);
  });

  const handles = {};
  Core.NAMES.forEach((key) => {
    handles[key] = board.handle(key, state[key], {
      r: 11, step: 4, cls: "geom-handle", layer: tops,
      label: `Point ${key}. Drag it, or focus it and use the arrow keys; Shift moves further.`,
      describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
      clamp: (p) => ({ x: Core.clamp(p.x, 0, state.width), y: Core.clamp(p.y, 0, state.height) }),
      onMove: (p) => { state = Core.movePoint(state, key, p); render(); },
    });
  });

  /** A short cross-stroke at the midpoint of a segment, like the applet's tick. */
  function tick(p, q, size) {
    const dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
    const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
    const ox = (-dy / len) * size, oy = (dx / len) * size;
    return [{ x: mx - ox, y: my - oy }, { x: mx + ox, y: my + oy }];
  }

  function draw(f) {
    circleE.set(f.E, f.E.r);
    circleF.set(f.F, f.F.r);
    guideGM.set(f.G, f.M);
    guideHL.set(f.H, f.L);
    circleO.set(f.O, f.O.r);
    chordQL.set(f.Q, f.L);
    chordQM.set(f.Q, f.M);
    chordPQ.set(f.P, f.Q);
    arcQ.set(f.Q, f.L, f.M, 22);

    hintLines[0].set(f.E, f.L);
    hintLines[1].set(f.E, f.P);
    hintLines[2].set(f.F, f.M);
    hintLines[3].set(f.F, f.P);
    hintLines[4].set(f.L, f.P);
    hintLines[5].set(f.M, f.P);
    apexE.set(f.E, f.L, f.P, 16);
    apexF.set(f.F, f.M, f.P, 16);
    baseL.set(f.L, f.E, f.P, 13);
    baseM.set(f.M, f.P, f.F, 13);
    ticks[0].set(...tick(f.E, f.P, 5));
    ticks[1].set(...tick(f.E, f.L, 5));
    ticks[2].set(...tick(f.F, f.P, 5));
    ticks[3].set(...tick(f.F, f.M, 5));

    dotKeys.forEach((key) => dotsByKey[key].set(f[key], 4));
    Object.keys(labels).forEach((key) => labels[key].set(f[key] || state[key]));
    Core.NAMES.forEach((key) => handles[key].set(state[key]));

    statements.style.display = state.show.statement1 || state.show.statement2 ? "" : "none";
    circleO.show(state.show.statement1);
    chordQL.show(state.show.statement2);
    chordQM.show(state.show.statement2);
    chordPQ.show(state.show.statement2);
    arcQ.show(state.show.statement2);
    hints.style.display = state.show.hint ? "" : "none";
    names.style.display = state.show.names ? "" : "none";
  }

  function render() {
    const next = Core.compute(state);
    if (next.valid && next.complete) figure = next;
    draw(figure);
    say(Core.describe(next));
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(Core.position(state));
  }

  Core.OPTIONS.forEach((key) => {
    const box = document.getElementById(key + "Box");
    box.addEventListener("change", () => {
      state = Core.setOption(state, key, box.checked);
      render();
    });
  });

  resetBtn.addEventListener("click", () => {
    state = Core.start({ show: state.show });
    Core.NAMES.forEach((key) => handles[key].set(state[key]));
    render();
  });

  board.onTheme(render);
  render();
})();
