"use strict";

/*
 * Half Area Of Quadrilateral — drawing and input only.  The geometry lives in
 * half-area-of-quadrilateral-core.js: four draggable corners A,B,C,D, the
 * midpoint K of BD, the point E where the line through K parallel to AC meets
 * AB or AD, and the crossing L used in the proof.  The pink quadrilateral and
 * the grey triangle are the two equal pieces; the three "Show" checkboxes
 * reproduce the applet's names, premise and hint overlays.  Every object is
 * created once and only updated on a redraw, so a handle keeps keyboard focus.
 */

(function () {
  const Core = HalfAreaOfQuadrilateralCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const namesBox = document.getElementById("names");
  const premiseBox = document.getElementById("premise");
  const hintBox = document.getElementById("hint");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start();

  /* Layers, back to front. */
  const fills = board.layer("fills");
  const hintLayer = board.layer("hint");
  const guides = board.layer("guides");
  const sides = board.layer("sides");
  const cutLayer = board.layer("cut");
  const dots = board.layer("dots");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  const first = Core.geometry(state);
  const halfPoly = board.polygon(first.quad, "half", fills);
  const otherPoly = board.polygon(first.tri, "other", fills);
  const triangleHints = [0, 1].map(() => board.polygon(first.tri, "hint-tri", hintLayer));
  const hintLines = [0, 1].map(() => board.segment(first.A, first.K, "hint-line", hintLayer));
  const premiseLines = [0, 1, 2].map(() => board.segment(first.A, first.B, "premise-line", guides));
  const tickMarks = [0, 1].map(() => board.segment(first.A, first.B, "tick", guides));
  const outline = [0, 1, 2, 3].map(() => board.segment(first.A, first.B, "side", sides));
  const cut = board.segment(first.C, first.E, "cut", cutLayer);
  const specialDots = [0, 1].map(() => board.point(first.K, "special-dot", 4, dots));
  const crossing = board.point(first.L, "crossing", 5, dots);

  const cornerKeys = ["A", "B", "C", "D"];
  const labelKeys = cornerKeys.concat(["E", "K", "L"]);
  const labelOffset = {
    A: [-17, -8], B: [-17, 17], C: [8, 17], D: [8, -8],
    E: [8, -13], K: [-21, 15], L: [8, -8],
  };
  const labelsFor = {};
  for (const key of labelKeys) {
    const off = labelOffset[key];
    labelsFor[key] = board.label(first[key], key, "point-label", off[0], off[1], labelsLayer);
  }

  const handles = {};
  for (const key of cornerKeys) {
    handles[key] = board.handle(key, state[key], {
      step: 5, shift: 15, r: 9, layer: handlesLayer,
      clamp: (p) => Core.clamp(p),
      label: `Corner ${key}. Drag it, or focus it and use the arrow keys to move the quadrilateral.`,
      onMove: (p, name) => {
        state = Core.move(state, name, p);
        render();
      },
    });
  }

  /** Two small marks on BD show that DK and KB are the same length. */
  function tickSegments(g) {
    return [[g.D, g.K], [g.K, g.B]].map(([p, q]) => {
      const v = Core.sub(q, p);
      const len = Math.hypot(v.x, v.y) || 1;
      const nx = -v.y / len * 5, ny = v.x / len * 5;
      const mid = Core.midpoint(p, q);
      return [Core.point(mid.x - nx, mid.y - ny), Core.point(mid.x + nx, mid.y + ny)];
    });
  }

  /**
   * #status is how the player's record sees an explored illustration.  A
   * demonstration has no win and no loss, so only "done" is ever used.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    for (const key of cornerKeys) handles[key].set(state[key]);
    const g = Core.geometry(state);
    hintBox.disabled = !state.options.premise;

    if (!g || !g.valid) {
      for (const s of [halfPoly, otherPoly, cut, crossing].concat(
        triangleHints, hintLines, premiseLines, tickMarks, outline, specialDots,
      )) s.show(false);
      for (const key of labelKeys) labelsFor[key].show(false);
      say(Core.describe(state), state.explored ? "done" : null);
      window.Track.state(state);
      return;
    }

    halfPoly.set(g.quad).show(true);
    otherPoly.set(g.tri).show(true);

    const pairs = [[g.A, g.B], [g.B, g.C], [g.C, g.D], [g.D, g.A]];
    for (let i = 0; i < outline.length; i++) outline[i].set(pairs[i][0], pairs[i][1]).show(true);
    cut.set(g.C, g.E).show(true);

    for (let i = 0; i < premiseLines.length; i++) {
      premiseLines[i].set(g.premiseLines[i][0], g.premiseLines[i][1]).show(state.options.premise);
    }
    const ticks = tickSegments(g);
    for (let i = 0; i < tickMarks.length; i++) {
      tickMarks[i].set(ticks[i][0], ticks[i][1]).show(state.options.premise);
    }
    for (let i = 0; i < specialDots.length; i++) {
      specialDots[i].set([g.K, g.E][i]).show(state.options.premise);
    }

    for (let i = 0; i < triangleHints.length; i++) {
      triangleHints[i].set(g.hintTriangles[i]).show(state.options.hint);
      hintLines[i].set(g.hintLines[i][0], g.hintLines[i][1]).show(state.options.hint);
    }
    crossing.set(g.L).show(state.options.hint);

    for (const key of cornerKeys) {
      labelsFor[key].set(g[key]).show(state.options.names);
    }
    labelsFor.E.set(g.E).show(state.options.names && state.options.premise);
    labelsFor.K.set(g.K).show(state.options.names && state.options.premise);
    labelsFor.L.set(g.L).show(state.options.names && state.options.hint);

    say(Core.describe(state), state.explored ? "done" : null);

    /* Board units, for the player's record and the tutor. */
    window.Track.state({
      A: g.A, B: g.B, C: g.C, D: g.D, K: g.K, E: g.E, L: g.L,
      side: g.side, options: state.options, explored: state.explored,
      areas: g.areas, claims: g.claims,
    });
  }

  namesBox.addEventListener("change", () => {
    state = Core.setOption(state, "names", namesBox.checked);
    render();
  });
  premiseBox.addEventListener("change", () => {
    state = Core.setOption(state, "premise", premiseBox.checked);
    hintBox.checked = state.options.hint;
    render();
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOption(state, "hint", hintBox.checked);
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    namesBox.checked = state.options.names;
    premiseBox.checked = state.options.premise;
    hintBox.checked = state.options.hint;
    render();
  });

  board.onTheme(render);
  render();
})();
