"use strict";

/*
 * The page for Inscribed Square: drawing and input only. All geometry lives
 * in inscribed-square-core.js, a transcription of the applet's DrawSquare and
 * its mouse constraints. The stage is an SVG with the applet's 600x450
 * viewBox; layers keep the trial square, the triangle, the guide and the
 * handles in the same z-order as the Java canvas. Colours come from the site
 * tokens, so a theme flip needs only a redraw.
 */

(function () {
  const Core = InscribedSquareCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const range = document.getElementById("pRange");
  const namesBox = document.getElementById("namesBox");
  const resetBtn = document.getElementById("newBtn");
  const solveBtn = document.getElementById("solveBtn");

  let state = Core.start({});

  /** An illustration has no win and no loss; the status just describes it. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Painted in this order: guides, target square, trial square, triangle,
     labels, the three eyes, and the draggable points on top. */
  const guides = board.layer("guides");
  const targetLayer = board.layer("target");
  const trialLayer = board.layer("trial");
  const triangleLayer = board.layer("triangle");
  const textLayer = board.layer("text");
  const eyeLayer = board.layer("eyes");
  const tops = board.layer("handles");

  const baseLine = board.line(state.A, state.B, "base-line", guides);
  const rayLine = board.segment(state.A, state.B, "guide-line", guides);
  const tri = [
    board.segment(state.A, state.B, "tri-side", triangleLayer),
    board.segment(state.B, state.C, "tri-side", triangleLayer),
    board.segment(state.C, state.A, "tri-side", triangleLayer),
  ];
  const trial = Array.from({ length: 8 }, () =>
    board.segment(state.A, state.B, "trial-side", trialLayer));
  const target = board.polygon([state.A, state.B, state.C], "target-square", targetLayer);

  const nameA = board.label(state.A, "A", "pt-label", -18, -12, textLayer);
  const nameB = board.label(state.B, "B", "pt-label", 10, -12, textLayer);
  const nameC = board.label(state.C, "C", "pt-label", 10, -12, textLayer);
  const nameP = board.label(state.P, "P", "pt-label", -6, 24, textLayer);

  /* The applet's three little mouse-tracker eyes: open when gap < 1 px. */
  const eyes = [[50, 30], [Core.WIDTH - 80, 55], [230, 25]].map(([x, y]) => {
    const node = board.el("path", null, "eye", eyeLayer);
    return { node, x, y };
  });

  const labelFor = (name) => ({
    A: "Point A, left end of the base. Drag it, or focus it and use the arrow keys.",
    B: "Point B, right end of the base. Drag it, or focus it and use the arrow keys.",
    C: "Point C, the top corner of the triangle. Drag it, or focus it and use the arrow keys.",
    P: "Point P on the base. Drag it, or focus it and use the arrow keys to change the square's size.",
  }[name]);

  const handles = {};
  ["A", "B", "C", "P"].forEach((name) => {
    handles[name] = board.handle(name, state[name], {
      r: 10, step: 4, shift: 16, cls: "geom-handle", layer: tops,
      label: labelFor(name),
      describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
      onMove: (p) => { state = Core.move(state, name, p); render(); },
    });
  });

  function eyePath(x, y, open) {
    if (open) return `M ${x - 13} ${y} Q ${x} ${y - 12} ${x + 13} ${y} Q ${x} ${y + 12} ${x - 13} ${y}`;
    return `M ${x - 13} ${y} Q ${x} ${y + 7} ${x + 13} ${y}`;
  }

  function render() {
    const g = Core.geometry(state);

    baseLine.set(state.A, state.B);
    tri[0].set(state.A, state.B);
    tri[1].set(state.B, state.C);
    tri[2].set(state.C, state.A);

    g.lines.forEach(([a, b], i) => {
      trial[i].set(a, b);
      trial[i].show(true);
    });
    for (let i = g.lines.length; i < trial.length; i++) trial[i].show(false);

    if (g.r && Core.finite(g.r)) {
      // Only the ray from A through the free corner, up to the line BC.
      rayLine.set(state.A, g.target ? g.target.hit : g.r);
      rayLine.show(true);
    } else {
      rayLine.show(false);
    }
    if (g.target) {
      target.set([g.target.hit, g.target.foot1, g.target.foot2, g.target.top]);
      target.show(true);
    } else {
      target.show(false);
    }

    nameA.set(state.A, "A");
    nameB.set(state.B, "B");
    nameC.set(state.C, "C");
    nameP.set(state.P, "P");
    [nameA, nameB, nameC, nameP].forEach((n) => n.show(state.showNames));
    ["A", "B", "C", "P"].forEach((name) => handles[name].set(state[name]));
    eyes.forEach(({ node, x, y }) => node.setAttribute("d", eyePath(x, y, g.open)));

    const frac = Core.fraction(state);
    range.value = String(Math.max(Number(range.min), Math.min(Number(range.max), Math.round(frac * 1000) / 10)));
    namesBox.checked = state.showNames;

    if (!g.active) {
      say("Move P away from A to start the construction.");
    } else if (g.fallback) {
      say(`AC never meets the perpendicular at P; the short square has side ${g.side.toFixed(1)}.`);
    } else if (g.open) {
      say(`All four corners are on the sidelines. The square's side is ${g.side.toFixed(1)}.`);
    } else {
      say(`The free corner is ${g.gap.toFixed(1)} from BC. Slide P until the gap reaches zero.`);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  range.addEventListener("input", () => {
    const t = Number(range.value) / 100;
    if (Number.isFinite(t)) state = Core.setFraction(state, t);
    render();
  });
  namesBox.addEventListener("change", () => {
    state = Core.setShowNames(state, namesBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.start({ showNames: state.showNames });
    render();
  });
  solveBtn.addEventListener("click", () => {
    const t = Core.solutionFraction(state);
    if (t !== null) state = Core.setFraction(state, t);
    render();
  });

  board.onTheme(render);
  render();
})();
